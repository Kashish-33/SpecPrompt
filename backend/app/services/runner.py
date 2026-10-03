from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.schema import TestCase, TestRun, TestRunResult, TestSuite
from app.schemas.pydantic_models import TestCaseEvaluationResult
from app.services.cost import calculate_token_cost
from app.services.evaluator import evaluate_response


class SuiteNotFoundError(LookupError):
    """Raised when a suite id does not exist."""


@dataclass(frozen=True)
class LLMCallResult:
    output: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float
    error: Optional[str] = None


def format_prompt(template: str, variables: Optional[dict[str, Any]]) -> str:
    """Interpolate `{variable}` placeholders; missing keys are left unchanged."""
    if not template:
        return ""
    mapping = {str(key): "" if value is None else str(value) for key, value in (variables or {}).items()}

    class _SafeMap(dict[str, str]):
        def __missing__(self, key: str) -> str:
            return "{" + key + "}"

    try:
        return template.format_map(_SafeMap(mapping))
    except (ValueError, IndexError):
        return template


def wants_json_output(test_case: TestCase) -> bool:
    variables = test_case.input_variables or {}
    if bool(variables.get("expect_json")):
        return True
    fmt = str(variables.get("expected_format") or variables.get("format") or "").strip().lower()
    return fmt in {"json", "application/json"}


def resolve_api_key(provider: str, override: Optional[str]) -> Optional[str]:
    if override and override.strip():
        return override.strip()
    if provider == "gemini":
        return (settings.gemini_api_key or "").strip() or None
    return (settings.openai_api_key or "").strip() or None


async def execute_suite_run(
    db: Session,
    suite_id: int,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    api_key: Optional[str] = None,
) -> TestRun:
    """Run every test case in a suite, persist results, and return the TestRun."""
    suite = db.execute(
        select(TestSuite)
        .options(selectinload(TestSuite.test_cases))
        .where(TestSuite.id == suite_id)
    ).scalar_one_or_none()
    if suite is None:
        raise SuiteNotFoundError(f"Test suite {suite_id} was not found.")

    resolved_provider = (provider or settings.llm_provider or "openai").strip().lower()
    resolved_model = (model or settings.llm_model or "gpt-4o-mini").strip()
    resolved_key = resolve_api_key(resolved_provider, api_key)
    use_mock = resolved_key is None or resolved_provider in {"mock", "demo"}
    
    print(f"\n[DEBUG] Provider: {resolved_provider} | Model: {resolved_model} | Has_Key: {bool(resolved_key)} | Use_Mock: {use_mock}\n")
    
    run = TestRun(suite_id=suite.id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    evaluations: list[TestCaseEvaluationResult] = []
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
            for test_case in suite.test_cases:
                evaluation = await _run_test_case(
                    client=client,
                    suite=suite,
                    test_case=test_case,
                    provider=resolved_provider,
                    model=resolved_model,
                    api_key=resolved_key,
                    use_mock=use_mock,
                )
                evaluations.append(evaluation)
                db.add(
                    TestRunResult(
                        run_id=run.id,
                        test_case_id=test_case.id,
                        baseline_output=evaluation.baseline_output,
                        candidate_output=evaluation.candidate_output,
                        passed=evaluation.passed,
                        failure_reason="; ".join(evaluation.failure_reasons) or None,
                        latency_ms=evaluation.latency_ms,
                    )
                )

        latencies = [item.latency_ms for item in evaluations if item.latency_ms is not None]
        run.total_passed = sum(1 for item in evaluations if item.passed)
        run.total_failed = sum(1 for item in evaluations if not item.passed)
        run.avg_latency_ms = round(sum(latencies) / len(latencies), 3) if latencies else 0.0
        run.total_cost_usd = round(sum(item.cost_usd for item in evaluations), 8)
        run.status = "completed"
        db.commit()
        db.refresh(run)
        return run
    except Exception:
        run_id = run.id
        db.rollback()
        persisted = db.get(TestRun, run_id)
        if persisted is not None:
            persisted.status = "failed"
            db.commit()
        raise


async def _run_test_case(
    *,
    client: httpx.AsyncClient,
    suite: TestSuite,
    test_case: TestCase,
    provider: str,
    model: str,
    api_key: Optional[str],
    use_mock: bool,
) -> TestCaseEvaluationResult:
    variables = test_case.input_variables or {}
    baseline_prompt = format_prompt(suite.baseline_prompt, variables)
    candidate_prompt = format_prompt(suite.candidate_prompt, variables)
    expect_json = wants_json_output(test_case)

    baseline_call, candidate_call = await asyncio.gather(
        call_llm(
            client,
            prompt=baseline_prompt,
            provider=provider,
            model=model,
            api_key=api_key,
            use_mock=use_mock,
            test_case=test_case,
            role="baseline",
            expect_json=expect_json,
        ),
        call_llm(
            client,
            prompt=candidate_prompt,
            provider=provider,
            model=model,
            api_key=api_key,
            use_mock=use_mock,
            test_case=test_case,
            role="candidate",
            expect_json=expect_json,
        ),
    )

    outcome = evaluate_response(
        candidate_call.output,
        expected_keywords=test_case.expected_keywords,
        forbidden_keywords=test_case.forbidden_keywords,
        max_latency_ms=test_case.max_latency_ms,
        actual_latency_ms=candidate_call.latency_ms,
        expect_json=expect_json,
    )

    failure_reasons = list(outcome.failure_reasons)
    if candidate_call.error:
        failure_reasons.append(f"Candidate LLM call failed: {candidate_call.error}")
    if baseline_call.error:
        failure_reasons.append(f"Baseline LLM call failed: {baseline_call.error}")

    cost_usd = calculate_token_cost(
        model, baseline_call.prompt_tokens, baseline_call.completion_tokens
    ) + calculate_token_cost(
        model, candidate_call.prompt_tokens, candidate_call.completion_tokens
    )

    passed = outcome.passed and candidate_call.error is None
    return TestCaseEvaluationResult(
        test_case_id=test_case.id,
        baseline_output=baseline_call.output,
        candidate_output=candidate_call.output,
        passed=passed,
        failure_reasons=failure_reasons,
        latency_ms=round(candidate_call.latency_ms, 3),
        cost_usd=cost_usd,
        assertions=outcome.assertions,
    )


async def call_llm(
    client: httpx.AsyncClient,
    *,
    prompt: str,
    provider: str,
    model: str,
    api_key: Optional[str],
    use_mock: bool,
    test_case: TestCase,
    role: str,
    expect_json: bool,
) -> LLMCallResult:
    if use_mock:
        return _mock_llm_call(prompt, test_case=test_case, role=role, expect_json=expect_json)

    started = time.perf_counter()
    try:
        if provider == "gemini":
            return await _call_gemini(client, prompt=prompt, model=model, api_key=api_key or "", started=started)
        return await _call_openai_compatible(
            client,
            prompt=prompt,
            model=model,
            api_key=api_key or "",
            started=started,
        )
    except httpx.HTTPError as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        return LLMCallResult(
            output="",
            prompt_tokens=_estimate_tokens(prompt),
            completion_tokens=0,
            latency_ms=latency_ms,
            error=str(exc),
        )


def _mock_llm_call(
    prompt: str,
    *,
    test_case: TestCase,
    role: str,
    expect_json: bool,
) -> LLMCallResult:
    digest = hashlib.sha256(f"{role}:{prompt}".encode("utf-8")).hexdigest()[:12]
    expected = [item for item in (test_case.expected_keywords or []) if item and str(item).strip()]
    seed_text = " ".join(str(item) for item in expected) if expected else "stable demo output"

    if expect_json:
        payload = {
            "mode": "mock",
            "role": role,
            "digest": digest,
            "keywords": expected,
            "message": seed_text,
        }
        output = json.dumps(payload)
    else:
        prefix = "BASELINE" if role == "baseline" else "CANDIDATE"
        output = f"{prefix} mock/{digest}: {seed_text}"

    prompt_tokens = _estimate_tokens(prompt)
    completion_tokens = _estimate_tokens(output)
    # Deterministic, sub-threshold latency so demo runs stay stable.
    latency_ms = 12.0 if role == "baseline" else 18.0
    return LLMCallResult(
        output=output,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
    )


async def _call_openai_compatible(
    client: httpx.AsyncClient,
    *,
    prompt: str,
    model: str,
    api_key: str,
    started: float,
) -> LLMCallResult:
    url = settings.openai_base_url.rstrip("/") + "/chat/completions"
    response = await client.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        },
    )
    latency_ms = (time.perf_counter() - started) * 1000
    if response.status_code >= 400:
        return LLMCallResult(
            output="",
            prompt_tokens=_estimate_tokens(prompt),
            completion_tokens=0,
            latency_ms=latency_ms,
            error=f"OpenAI-compatible HTTP {response.status_code}: {response.text[:300]}",
        )

    data = response.json()
    choices = data.get("choices") or []
    message = choices[0].get("message", {}) if choices else {}
    output = str(message.get("content") or "")
    usage = data.get("usage") or {}
    return LLMCallResult(
        output=output,
        prompt_tokens=int(usage.get("prompt_tokens") or _estimate_tokens(prompt)),
        completion_tokens=int(usage.get("completion_tokens") or _estimate_tokens(output)),
        latency_ms=latency_ms,
    )


async def _call_gemini(
    client: httpx.AsyncClient,
    *,
    prompt: str,
    model: str,
    api_key: str,
    started: float,
) -> LLMCallResult:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    response = await client.post(
        url,
        params={"key": api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
    )
    latency_ms = (time.perf_counter() - started) * 1000
    if response.status_code >= 400:
        return LLMCallResult(
            output="",
            prompt_tokens=_estimate_tokens(prompt),
            completion_tokens=0,
            latency_ms=latency_ms,
            error=f"Gemini HTTP {response.status_code}: {response.text[:300]}",
        )

    data = response.json()
    candidates = data.get("candidates") or []
    parts = ((candidates[0].get("content") or {}).get("parts") or []) if candidates else []
    output = "".join(str(part.get("text") or "") for part in parts)
    usage = data.get("usageMetadata") or {}
    return LLMCallResult(
        output=output,
        prompt_tokens=int(usage.get("promptTokenCount") or _estimate_tokens(prompt)),
        completion_tokens=int(usage.get("candidatesTokenCount") or _estimate_tokens(output)),
        latency_ms=latency_ms,
    )


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)
