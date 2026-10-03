from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schema import TestRun, TestRunResult, TestSuite
from app.schemas.pydantic_models import MetricsOverview

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get(
    "/overview",
    response_model=MetricsOverview,
    status_code=status.HTTP_200_OK,
)
def metrics_overview(db: Session = Depends(get_db)) -> MetricsOverview:
    total_suites = db.scalar(select(func.count()).select_from(TestSuite)) or 0
    total_runs = db.scalar(select(func.count()).select_from(TestRun)) or 0
    total_tests = db.scalar(select(func.count()).select_from(TestRunResult)) or 0
    passed = (
        db.scalar(
            select(func.count()).select_from(TestRunResult).where(TestRunResult.passed.is_(True))
        )
        or 0
    )
    avg_latency = db.scalar(select(func.avg(TestRunResult.latency_ms))) or 0.0
    total_cost = db.scalar(select(func.coalesce(func.sum(TestRun.total_cost_usd), 0.0))) or 0.0
    pass_rate = round((passed / total_tests) * 100, 1) if total_tests else 0.0
    return MetricsOverview(
        total_suites=int(total_suites),
        total_runs=int(total_runs),
        total_tests_executed=int(total_tests),
        overall_pass_rate=pass_rate,
        avg_latency_ms=round(float(avg_latency), 3),
        total_cost_usd=round(float(total_cost), 8),
    )
