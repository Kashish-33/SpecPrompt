from __future__ import annotations

# USD per 1M tokens: (input, output)
_MODEL_RATES: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o-mini-2024-07-18": (0.15, 0.60),
    "gemini-flash": (0.15, 0.60),
    "gemini-1.5-flash": (0.15, 0.60),
    "gemini-1.5-flash-latest": (0.15, 0.60),
    "gemini-2.0-flash": (0.15, 0.60),
    "gemini-2.0-flash-lite": (0.075, 0.30),
    "gemini-2.5-flash": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-5-haiku": (0.80, 4.00),
}

_DEFAULT_INPUT_PER_MILLION = 0.15
_DEFAULT_OUTPUT_PER_MILLION = 0.60


def calculate_token_cost(
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> float:
    """Return estimated USD cost for a single completion call."""
    input_rate, output_rate = _rates_for_model(model_name)
    prompt = max(0, prompt_tokens)
    completion = max(0, completion_tokens)
    cost = (prompt / 1_000_000) * input_rate + (completion / 1_000_000) * output_rate
    return round(cost, 8)


def _rates_for_model(model_name: str) -> tuple[float, float]:
    key = (model_name or "").strip().lower()
    if key in _MODEL_RATES:
        return _MODEL_RATES[key]
    for known, rates in _MODEL_RATES.items():
        if known in key or key in known:
            return rates
    return (_DEFAULT_INPUT_PER_MILLION, _DEFAULT_OUTPUT_PER_MILLION)
