from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class TestCaseCreate(BaseModel):
    suite_id: Optional[int] = None
    input_variables: dict[str, Any] = Field(default_factory=dict)
    expected_keywords: list[str] = Field(default_factory=list)
    forbidden_keywords: list[str] = Field(default_factory=list)
    max_latency_ms: Optional[int] = None


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    suite_id: int
    input_variables: dict[str, Any]
    expected_keywords: list[str]
    forbidden_keywords: list[str]
    max_latency_ms: Optional[int] = None


class TestSuiteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    baseline_prompt: str
    candidate_prompt: str
    test_cases: list[TestCaseCreate] = Field(default_factory=list)


class TestSuiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    baseline_prompt: str
    candidate_prompt: str
    created_at: datetime


class TestSuiteDetailResponse(TestSuiteResponse):
    test_cases: list[TestCaseResponse] = Field(default_factory=list)


class TestSuiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    baseline_prompt: Optional[str] = None
    candidate_prompt: Optional[str] = None


class RunTriggerRequest(BaseModel):
    suite_id: int
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class AssertionResult(BaseModel):
    name: str
    passed: bool
    details: str


class TestCaseEvaluationResult(BaseModel):
    test_case_id: int
    baseline_output: Optional[str] = None
    candidate_output: Optional[str] = None
    passed: bool
    failure_reasons: list[str] = Field(default_factory=list)
    latency_ms: Optional[float] = None
    cost_usd: float = 0.0
    assertions: list[AssertionResult] = Field(default_factory=list)


class TestRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: int
    suite_id: int
    status: str
    total_passed: int
    total_failed: int
    avg_latency_ms: Optional[float] = None
    total_cost_usd: float = 0.0
    results: list[TestCaseEvaluationResult] = Field(default_factory=list)


class TestRunSummary(BaseModel):
    run_id: int
    suite_id: int
    status: str
    total_passed: int
    total_failed: int
    avg_latency_ms: Optional[float] = None
    total_cost_usd: float = 0.0
    created_at: datetime


class MetricsOverview(BaseModel):
    total_suites: int
    total_runs: int
    total_tests_executed: int
    overall_pass_rate: float
    avg_latency_ms: float
    total_cost_usd: float
