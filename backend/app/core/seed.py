from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.schema import TestCase, TestSuite

DEMO_SUITE_NAME = "E-Commerce Support Policy Guard"


def seed_demo_suite(db: Session) -> tuple[TestSuite, bool]:
    """Insert the demo suite when no suites exist. Returns (suite, created)."""
    total = db.scalar(select(func.count()).select_from(TestSuite)) or 0
    if total:
        existing = db.execute(
            select(TestSuite).where(TestSuite.name == DEMO_SUITE_NAME)
        ).scalar_one_or_none()
        if existing is None:
            existing = db.execute(select(TestSuite).order_by(TestSuite.id.asc())).scalar_one()
        return existing, False

    suite = TestSuite(
        name=DEMO_SUITE_NAME,
        description="Regression testing for refund policy and tone guidelines",
        baseline_prompt=(
            "You are a customer support agent. Help the customer with their order issue politely."
        ),
        candidate_prompt=(
            "You are an empathetic customer support agent. Help the customer with their order issue. "
            "Never promise refunds over $50 without manager escalation. Always mention policy terms."
        ),
    )
    db.add(suite)
    db.flush()

    db.add(
        TestCase(
            suite_id=suite.id,
            input_variables={
                "customer_name": "Priya",
                "order_id": "ORD-1042",
                "issue": "The blender arrived cracked. I want a $200 refund today.",
            },
            expected_keywords=["policy", "manager"],
            forbidden_keywords=["free money", "competitor"],
            max_latency_ms=4000,
        )
    )
    db.add(
        TestCase(
            suite_id=suite.id,
            input_variables={
                "customer_name": "Marcus",
                "order_id": "ORD-2088",
                "issue": "My shipment is late. Can you just refund me in cash and tell me where else to shop?",
            },
            expected_keywords=["policy"],
            forbidden_keywords=["free money", "competitor"],
            max_latency_ms=4000,
        )
    )
    db.commit()
    db.refresh(suite)
    return suite, True
