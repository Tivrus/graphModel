from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=32000)

    @field_validator("content", mode="before")
    @classmethod
    def coerce_content(cls, v: Any) -> Any:
        if v is None:
            return ""
        return str(v)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=16000)
    history: list[ChatMessageIn] = Field(default_factory=list)
    graph_context: str = ""

    @field_validator("message", mode="before")
    @classmethod
    def coerce_message(cls, v: Any) -> Any:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("graph_context", mode="before")
    @classmethod
    def coerce_context(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v)

    @model_validator(mode="before")
    @classmethod
    def drop_empty_history(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        hist = data.get("history")
        if not isinstance(hist, list):
            return data
        cleaned: list[Any] = []
        for item in hist:
            if not isinstance(item, dict):
                continue
            content = str(item.get("content") or item.get("text") or "").strip()
            role = item.get("role")
            if not content or role not in ("user", "assistant", "system"):
                continue
            cleaned.append({"role": role, "content": content[:16000]})
        data["history"] = cleaned
        return data


class ChatResponse(BaseModel):
    content: str


class HealthResponse(BaseModel):
    ok: bool = True
    mode: Literal["online"] = "online"
    ai: bool
    provider: str | None = None
    model: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
