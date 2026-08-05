from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .ai import ai_ready, ask_llm, start_ai, stop_ai
from .config import get_settings
from .schemas import ChatRequest, ChatResponse, HealthResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.ai_configured:
        await asyncio.to_thread(start_ai, settings)
    try:
        yield
    finally:
        await asyncio.to_thread(stop_ai)


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    print("[422] validation error:", exc.errors(), flush=True)
    print("[422] body:", exc.body, flush=True)
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Некорректное тело запроса",
            "errors": exc.errors(),
        },
    )


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    configured = settings.ai_configured
    return HealthResponse(
        ok=True,
        mode="online",
        ai=configured and ai_ready(),
        provider="qwen" if configured else None,
        model="qwen-web" if configured else None,
        extras={"finger_remote": True, "ai_configured": configured},
    )


@app.post("/api/ai/chat", response_model=ChatResponse)
async def ai_chat(body: ChatRequest) -> ChatResponse:
    if not settings.ai_configured:
        raise HTTPException(
            status_code=503,
            detail="Сервер в online-режиме, но QWEN_EMAIL/QWEN_PASSWORD не заданы. Локальный фронт работает без AI.",
        )
    content = await ask_llm(
        settings=settings,
        message=body.message.strip(),
        history=[m.model_dump() for m in body.history],
        graph_context=body.graph_context or "",
    )
    return ChatResponse(content=content)
