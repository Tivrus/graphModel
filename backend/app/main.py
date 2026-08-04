from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai import ask_llm
from .config import get_settings
from .schemas import ChatRequest, ChatResponse, HealthResponse

settings = get_settings()

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        mode="online",
        ai=settings.ai_configured,
        provider="openrouter" if "openrouter" in settings.ai_endpoint else "custom",
        model=settings.ai_model if settings.ai_configured else None,
        extras={"finger_remote": True},
    )


@app.post("/api/ai/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequest) -> ChatResponse:
    if not settings.ai_configured:
        raise HTTPException(
            status_code=503,
            detail="Сервер в online-режиме, но AI_API_KEY не задан. Локальный фронт работает без AI.",
        )
    content = await ask_llm(
        settings=settings,
        message=body.message.strip(),
        history=[m.model_dump() for m in body.history],
        graph_context=body.graph_context or "",
    )
    return ChatResponse(content=content)
