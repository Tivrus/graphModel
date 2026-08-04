from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessageIn] = Field(default_factory=list)
    graph_context: str = ""


class ChatResponse(BaseModel):
    content: str


class HealthResponse(BaseModel):
    ok: bool = True
    mode: Literal["online"] = "online"
    ai: bool
    provider: str | None = None
    model: str | None = None
    extras: dict[str, Any] = Field(default_factory=dict)
