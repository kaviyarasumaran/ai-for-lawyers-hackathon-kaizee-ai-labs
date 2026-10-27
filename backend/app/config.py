from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    app_name: str = Field(default="lawyer_api", alias="APP_NAME")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_db: str = Field(default="lawyer_app", alias="MONGODB_DB")
    llm_api_base_url: str | None = Field(
        default="http://localhost:1234/v1",
        alias="LLM_API_BASE_URL",
    )
    llm_api_key: str | None = Field(default=None, alias="LLM_API_KEY")
    llm_model: str | None = Field(default=None, alias="LLM_MODEL")
    llm_timeout_seconds: float = Field(default=120, alias="LLM_TIMEOUT_SECONDS", gt=0, le=300)
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    supabase_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SUPABASE_SERVICE_ROLE_KEY",
            "SERVICE_ROLE_KEY",
            "SUPABASE_SECRET_KEY",
        ),
    )
    supabase_bucket: str = Field(default="case-documents", alias="SUPABASE_BUCKET")
    supabase_timeout_seconds: float = Field(
        default=120,
        alias="SUPABASE_TIMEOUT_SECONDS",
        gt=0,
        le=300,
    )
    embedding_api_base_url: str | None = Field(
        default="http://localhost:1234/v1",
        alias="EMBEDDING_API_BASE_URL",
    )
    embedding_api_key: str | None = Field(default=None, alias="EMBEDDING_API_KEY")
    embedding_model: str | None = Field(
        default="text-embedding-nomic-embed-text-v1.5",
        alias="EMBEDDING_MODEL",
    )
    embedding_timeout_seconds: float = Field(
        default=60,
        alias="EMBEDDING_TIMEOUT_SECONDS",
        gt=0,
        le=180,
    )
    chat_query_embeddings: bool = Field(
        default=False,
        alias="CHAT_QUERY_EMBEDDINGS",
    )
    transcription_api_base_url: str | None = Field(
        default=None,
        alias="TRANSCRIPTION_API_BASE_URL",
    )
    transcription_api_key: str | None = Field(
        default=None,
        alias="TRANSCRIPTION_API_KEY",
    )
    whisper_cli_path: str | None = Field(default=None, alias="WHISPER_CLI_PATH")
    whisper_model_path: str | None = Field(default=None, alias="WHISPER_MODEL_PATH")
    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    postgres_dsn: str | None = Field(default=None, alias="POSTGRES_DSN")
    postgres_tenant_id: str | None = Field(default=None, alias="POSTGRES_TENANT_ID")
    pipeline_poll_seconds: float = Field(
        default=2,
        alias="PIPELINE_POLL_SECONDS",
        gt=0,
        le=60,
    )
    pipeline_max_attempts: int = Field(default=5, alias="PIPELINE_MAX_ATTEMPTS", ge=1, le=20)
    jwt_secret: str = Field(default="dev-insecure-secret-key-replace-in-production", alias="JWT_SECRET")
    chat_history_window: int = Field(default=10, alias="CHAT_HISTORY_WINDOW", ge=1, le=50)
    retrieval_top_k: int = Field(default=5, alias="RETRIEVAL_TOP_K", ge=1, le=20)
    retrieval_relevance_threshold: float = Field(default=0.01, alias="RETRIEVAL_RELEVANCE_THRESHOLD", ge=0.0)
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE", ge=1, le=1000)

    model_config = SettingsConfigDict(
        env_file=BACKEND_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
