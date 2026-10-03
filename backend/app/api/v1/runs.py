from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.core.config import settings

from app.core.database import get_db
from app.models.schema import TestCase, TestRun, TestRunResult, TestSuite
from app.schemas.pydantic_models import (
    AssertionResult,
    RunTriggerRequest,
    TestCaseEvaluationResult,
    TestRunResponse,
    TestRunSummary,
)
from app.services.evaluator import evaluate_response
from app.services.runner import SuiteNotFoundError, execute_suite_run, wants_json_output

router = APIRouter(prefix="/runs", tags=["runs"])


def _failure_reasons(stored: str | None) -> list[str]:
    if not stored:
        return []
    return [part.strip() for part in stored.split(";") if part.strip()]


def serialize_run(run: TestRun, results: list[TestCaseEvaluationResult]) -> TestRunResponse:
    return TestRunResponse(
        run_id=run.id,
        suite_id=run.suite_id,
        status=run.status,
        total_passed=run.total_passed,
        total_failed=run.total_failed,
        avg_latency_ms=run.avg_latency_ms,
        total_cost_usd=run.total_cost_usd,
        results=results,
    )


def serialize_result(row: TestRunResult, test_case: TestCase | None) -> TestCaseEvaluationResult:
    assertions: list[AssertionResult] = []
    if test_case is not None:
        outcome = evaluate_response(
            row.candidate_output or "",
            expected_keywords=test_case.expected_keywords,
            forbidden_keywords=test_case.forbidden_keywords,
            max_latency_ms=test_case.max_latency_ms,
            actual_latency_ms=row.latency_ms,
            expect_json=wants_json_output(test_case),
        )
        assertions = outcome.assertions
    return TestCaseEvaluationResult(
        test_case_id=row.test_case_id,
        baseline_output=row.baseline_output,
        candidate_output=row.candidate_output,
        passed=row.passed,
        failure_reasons=_failure_reasons(row.failure_reason),
        latency_ms=row.latency_ms,
        cost_usd=0.0,
        assertions=assertions,
    )


def load_run_response(db: Session, run: TestRun) -> TestRunResponse:
    rows = list(
        db.execute(
            select(TestRunResult)
            .where(TestRunResult.run_id == run.id)
            .order_by(TestRunResult.id.asc())
        )
        .scalars()
        .all()
    )
    case_ids = {row.test_case_id for row in rows}
    cases: dict[int, TestCase] = {}
    if case_ids:
        cases = {
            case.id: case
            for case in db.execute(select(TestCase).where(TestCase.id.in_(case_ids))).scalars().all()
        }
    return serialize_run(run, [serialize_result(row, cases.get(row.test_case_id)) for row in rows])


@router.post(
    "/execute",
    response_model=TestRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_run(
    payload: RunTriggerRequest,
    db: Session = Depends(get_db),
) -> TestRunResponse:
    # Agar provider mock/none aaya hai, to .env ka gemini use karein
    active_provider = payload.provider if payload.provider not in (None, "mock") else settings.llm_provider
    active_model = payload.model or settings.llm_model
    active_key = payload.api_key or settings.openai_api_key

    try:
        run = await execute_suite_run(
            db,
            payload.suite_id,
            provider=active_provider,
            model=active_model,
            api_key=active_key,
        )
    except SuiteNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Suite run failed: {exc}",
        ) from exc
    return load_run_response(db, run)

@router.get(
    "/suite/{suite_id}",
    response_model=list[TestRunSummary],
    status_code=status.HTTP_200_OK,
)
def list_suite_runs(suite_id: int, db: Session = Depends(get_db)) -> list[TestRunSummary]:
    suite = db.execute(select(TestSuite).where(TestSuite.id == suite_id)).scalar_one_or_none()
    if suite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test suite {suite_id} was not found.",
        )
    runs = (
        db.execute(
            select(TestRun)
            .where(TestRun.suite_id == suite_id)
            .order_by(TestRun.created_at.desc(), TestRun.id.desc())
        )
        .scalars()
        .all()
    )
    return [
        TestRunSummary(
            run_id=run.id,
            suite_id=run.suite_id,
            status=run.status,
            total_passed=run.total_passed,
            total_failed=run.total_failed,
            avg_latency_ms=run.avg_latency_ms,
            total_cost_usd=run.total_cost_usd,
            created_at=run.created_at,
        )
        for run in runs
    ]


@router.get(
    "/{run_id}",
    response_model=TestRunResponse,
    status_code=status.HTTP_200_OK,
)
def get_run(run_id: int, db: Session = Depends(get_db)) -> TestRunResponse:
    run = db.execute(
        select(TestRun).options(selectinload(TestRun.results)).where(TestRun.id == run_id)
    ).scalar_one_or_none()
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run {run_id} was not found.",
        )
    return load_run_response(db, run)
