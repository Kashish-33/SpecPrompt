from typing import Optional
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SpecPrompt"
    database_url: str = "sqlite:///./specprompt.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    llm_provider: str = "openai"
    llm_model: str = "openai/gpt-oss-20b"

    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.groq.com/openai/v1"

    openai_api_key: Optional[str] = None
    llm_timeout_seconds: float = 60.0


settings = Settings()
