from __future__ import annotations

from functools import lru_cache

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV) if _ENV.is_file() else ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GraphModel API"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,null,file://"

    # Qwen через web_ai_parser (браузерный клиент)
    qwen_email: str = ""
    qwen_password: str = ""
    qwen_headless: bool = False
    qwen_timeout: int = 120

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.qwen_email.strip() and self.qwen_password.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
