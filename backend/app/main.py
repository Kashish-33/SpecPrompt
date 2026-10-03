from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1 import metrics, runs, suites
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine, get_db
from app.core.seed import seed_demo_suite
from app.models import schema  # noqa: F401  — register ORM models on Base.metadata
from app.models.schema import TestSuite
from app.schemas.pydantic_models import TestSuiteDetailResponse


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_suite(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(suites.router, prefix="/api/v1")
app.include_router(runs.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")


def _suite_with_cases(db: Session, suite_id: int) -> TestSuite:
    return db.execute(
        select(TestSuite)
        .options(selectinload(TestSuite.test_cases))
        .where(TestSuite.id == suite_id)
    ).scalar_one()


@app.get("/health", response_model=dict[str, str], status_code=status.HTTP_200_OK)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/api/v1/seed",
    response_model=TestSuiteDetailResponse,
)
def seed_database(response: Response, db: Session = Depends(get_db)) -> TestSuite:
    suite, created = seed_demo_suite(db)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return _suite_with_cases(db, suite.id)
