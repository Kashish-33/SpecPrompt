from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Optional

from app.schemas.pydantic_models import AssertionResult

_FENCE_RE = re.compile(r"^```(?:json)?\s*\n(?P<body>.*)\n```\s*$", re.DOTALL | re.IGNORECASE)


@dataclass(frozen=True)
class EvaluationOutcome:
    passed: bool
    failure_reasons: list[str]
    assertions: list[AssertionResult]


def evaluate_response(
    output: str,
    *,
    expected_keywords: Optional[list[str]] = None,
    forbidden_keywords: Optional[list[str]] = None,
    max_latency_ms: Optional[int] = None,
    actual_latency_ms: Optional[float] = None,
    expect_json: bool = False,
    case_insensitive: bool = True,
) -> EvaluationOutcome:
    """Run keyword, latency, and optional JSON assertions against an LLM output."""
    text = output or ""
    haystack = text.lower() if case_insensitive else text
    assertions: list[AssertionResult] = []
    failure_reasons: list[str] = []

    expected = _clean_keywords(expected_keywords)
    if expected:
        missing = [
            keyword
            for keyword in expected
            if _normalize(keyword, case_insensitive) not in haystack
        ]
        passed = not missing
        details = (
            "All expected keywords were present."
            if passed
            else f"Missing expected keywords: {', '.join(missing)}"
        )
        assertions.append(AssertionResult(name="expected_keywords", passed=passed, details=details))
        if not passed:
            failure_reasons.append(details)
    else:
        assertions.append(
            AssertionResult(
                name="expected_keywords",
                passed=True,
                details="No expected keywords specified.",
            )
        )

    forbidden = _clean_keywords(forbidden_keywords)
    if forbidden:
        hits = [
            keyword
            for keyword in forbidden
            if _normalize(keyword, case_insensitive) in haystack
        ]
        passed = not hits
        details = (
            "No forbidden keywords were present."
            if passed
            else f"Forbidden keywords found: {', '.join(hits)}"
        )
        assertions.append(AssertionResult(name="forbidden_keywords", passed=passed, details=details))
        if not passed:
            failure_reasons.append(details)
    else:
        assertions.append(
            AssertionResult(
                name="forbidden_keywords",
                passed=True,
                details="No forbidden keywords specified.",
            )
        )

    if max_latency_ms is not None:
        if actual_latency_ms is None:
            assertions.append(
                AssertionResult(
                    name="max_latency_ms",
                    passed=True,
                    details="Latency threshold set but actual latency was not measured; check skipped.",
                )
            )
        elif actual_latency_ms > max_latency_ms:
            details = (
                f"Latency {actual_latency_ms:.2f}ms exceeded max_latency_ms={max_latency_ms}."
            )
            assertions.append(AssertionResult(name="max_latency_ms", passed=False, details=details))
            failure_reasons.append(details)
        else:
            assertions.append(
                AssertionResult(
                    name="max_latency_ms",
                    passed=True,
                    details=f"Latency {actual_latency_ms:.2f}ms within {max_latency_ms}ms.",
                )
            )

    if expect_json:
        payload = _extract_json_payload(text)
        try:
            json.loads(payload)
            assertions.append(
                AssertionResult(
                    name="json_validity",
                    passed=True,
                    details="Output parsed as valid JSON.",
                )
            )
        except json.JSONDecodeError as exc:
            details = f"Output is not valid JSON: {exc.msg}"
            assertions.append(AssertionResult(name="json_validity", passed=False, details=details))
            failure_reasons.append(details)

    return EvaluationOutcome(
        passed=len(failure_reasons) == 0,
        failure_reasons=failure_reasons,
        assertions=assertions,
    )


def _clean_keywords(keywords: Optional[list[str]]) -> list[str]:
    if not keywords:
        return []
    return [item.strip() for item in keywords if item and item.strip()]


def _normalize(value: str, case_insensitive: bool) -> str:
    return value.lower() if case_insensitive else value


def _extract_json_payload(text: str) -> str:
    stripped = text.strip()
    match = _FENCE_RE.match(stripped)
    if match:
        return match.group("body").strip()
    return stripped
