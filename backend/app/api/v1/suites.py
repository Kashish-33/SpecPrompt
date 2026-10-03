from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.models.schema import TestCase, TestRun, TestSuite
from app.schemas.pydantic_models import (
    TestCaseCreate,
    TestCaseResponse,
    TestSuiteCreate,
    TestSuiteDetailResponse,
    TestSuiteResponse,
    TestSuiteUpdate,
)

router = APIRouter(prefix="/suites", tags=["suites"])


def get_suite_or_404(db: Session, suite_id: int, *, with_cases: bool = False) -> TestSuite:
    stmt = select(TestSuite).where(TestSuite.id == suite_id)
    if with_cases:
        stmt = stmt.options(selectinload(TestSuite.test_cases))
    suite = db.execute(stmt).scalar_one_or_none()
    if suite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test suite {suite_id} was not found.",
        )
    return suite


@router.post(
    "/",
    response_model=TestSuiteDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_suite(payload: TestSuiteCreate, db: Session = Depends(get_db)) -> TestSuite:
    suite = TestSuite(
        name=payload.name,
        description=payload.description,
        baseline_prompt=payload.baseline_prompt,
        candidate_prompt=payload.candidate_prompt,
    )
    db.add(suite)
    db.flush()
    for case in payload.test_cases:
        db.add(
            TestCase(
                suite_id=suite.id,
                input_variables=case.input_variables,
                expected_keywords=case.expected_keywords,
                forbidden_keywords=case.forbidden_keywords,
                max_latency_ms=case.max_latency_ms,
            )
        )
    db.commit()
    return get_suite_or_404(db, suite.id, with_cases=True)


@router.get("/", response_model=list[TestSuiteResponse], status_code=status.HTTP_200_OK)
def list_suites(db: Session = Depends(get_db)) -> list[TestSuite]:
    return list(
        db.execute(select(TestSuite).order_by(TestSuite.created_at.desc(), TestSuite.id.desc()))
        .scalars()
        .all()
    )


@router.get(
    "/{suite_id}",
    response_model=TestSuiteDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_suite(suite_id: int, db: Session = Depends(get_db)) -> TestSuite:
    return get_suite_or_404(db, suite_id, with_cases=True)


@router.put(
    "/{suite_id}",
    response_model=TestSuiteResponse,
    status_code=status.HTTP_200_OK,
)
def update_suite(
    suite_id: int,
    payload: TestSuiteUpdate,
    db: Session = Depends(get_db),
) -> TestSuite:
    suite = get_suite_or_404(db, suite_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(suite, field, value)
    db.commit()
    db.refresh(suite)
    return suite


@router.delete(
    "/{suite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_suite(suite_id: int, db: Session = Depends(get_db)) -> None:
    get_suite_or_404(db, suite_id)
    suite = db.execute(
        select(TestSuite)
        .options(
            selectinload(TestSuite.test_cases),
            selectinload(TestSuite.test_runs).selectinload(TestRun.results),
        )
        .where(TestSuite.id == suite_id)
    ).scalar_one()
    db.delete(suite)
    db.commit()


@router.post(
    "/{suite_id}/cases",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_test_case(
    suite_id: int,
    payload: TestCaseCreate,
    db: Session = Depends(get_db),
) -> TestCase:
    get_suite_or_404(db, suite_id)
    case = TestCase(
        suite_id=suite_id,
        input_variables=payload.input_variables,
        expected_keywords=payload.expected_keywords,
        forbidden_keywords=payload.forbidden_keywords,
        max_latency_ms=payload.max_latency_ms,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.delete(
    "/{suite_id}/cases/{case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def delete_test_case(
    suite_id: int,
    case_id: int,
    db: Session = Depends(get_db),
) -> None:
    get_suite_or_404(db, suite_id)
    case = db.execute(
        select(TestCase).where(TestCase.id == case_id, TestCase.suite_id == suite_id)
    ).scalar_one_or_none()
    if case is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test case {case_id} was not found in suite {suite_id}.",
        )
    db.delete(case)
    db.commit()
