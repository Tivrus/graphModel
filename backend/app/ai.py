from __future__ import annotations

import asyncio
import os
from typing import Optional

from fastapi import HTTPException
from web_ai_parser import QwenClient

from .config import Settings

SYSTEM_PROMPT = """Ты — ассистент приложения GraphModel, среды для мышления графами. Отвечай по-русски, кратко и по делу.\n

Если пользователь просит создать, показать или изменить граф — верни СТРОГО один JSON-объект, без markdown-обрамления и без пояснений вокруг:
{"reply":"одно-два предложения комментария","graph":{"nodes":[{"id":"n1","label":"Название","group":"Группа","size":8}],"links":[{"source":"n1","target":"n2","kind":"связь","label":"подпись если нужна"}]}}

Правила для graph:
- id — короткие, латиницей/цифрами, уникальные (n1, n2, ... или осмысленные slug);
- label — по-русски, короткие (1-3 слова);
- group — осмысленное имя кластера по-русски (узлы одной темы = одна группа); 2-6 групп;
- size — от 5 до 12 (важные узлы крупнее);
- kind — только одно из: "связь", "зависимость", "поток";
- 10-40 узлов, если пользователь не просил иное; почти у каждого узла должна быть связь;
- source/target ссылаются только на существующие id.

Если просьба не про граф (вопрос, обсуждение) — отвечай обычным текстом БЕЗ JSON."""

_client: Optional[QwenClient] = None


def _flatten_newlines(text: str) -> str:
    """Убирает переносы строк: \\r\\n / \\n / \\r → литерал /n перед отправкой в веб-чат."""
    return text.replace("\r\n", "/n").replace("\n", "/n").replace("\r", "/n")


def _build_prompt(
    message: str,
    history: list[dict[str, str]],
    graph_context: str,
) -> str:
    parts = [SYSTEM_PROMPT + (graph_context or "")]
    history_lines: list[str] = []
    for item in history[-8:]:
        role = item.get("role")
        content = (item.get("content") or "")[:1500]
        if role in ("user", "assistant") and content:
            label = "Пользователь" if role == "user" else "Ассистент"
            history_lines.append(f"{label}: {content}")
    if history_lines:
        parts.append("\n--- История диалога ---")
        parts.extend(history_lines)
    parts.append("\n--- Текущий запрос ---")
    parts.append(f"Пользователь: {message}")
    parts.append("\nОтветь на текущий запрос согласно правилам выше.")
    return _flatten_newlines("\n".join(parts))


def start_ai(settings: Settings) -> bool:
    """Поднимает пул браузеров Qwen. Один процесс — один клиент."""
    global _client
    if not settings.ai_configured:
        return False
    if _client is not None:
        return True

    os.environ["QWEN_EMAIL"] = settings.qwen_email.strip()
    os.environ["QWEN_PASSWORD"] = settings.qwen_password.strip()

    client = QwenClient(num_browsers=1, headless=settings.qwen_headless)
    if not client.start():
        return False
    _client = client
    return True


def stop_ai() -> None:
    global _client
    if _client is not None:
        _client.stop()
        _client = None


def ai_ready() -> bool:
    return _client is not None


def _ask_sync(prompt: str, timeout: int) -> str | None:
    if _client is None:
        raise RuntimeError("AI-клиент не запущен")
    print(f"[AI] отправка в Qwen: {len(prompt)} символов, timeout={timeout}s", flush=True)
    print(f"[AI] prompt preview: {prompt[:240]!r}...", flush=True)
    answer = _client.ask(prompt, timeout=timeout, new_chat=True)
    print("[AI] ===== raw response from Qwen =====", flush=True)
    if answer is None:
        print("[AI] (None)", flush=True)
    else:
        print(f"[AI] length={len(answer)}", flush=True)
        print(answer, flush=True)
    print("[AI] ===== end response =====", flush=True)
    return answer


async def ask_llm(
    *,
    settings: Settings,
    message: str,
    history: list[dict[str, str]],
    graph_context: str,
) -> str:
    if not settings.ai_configured:
        raise HTTPException(
            status_code=503,
            detail="AI не настроен: задайте QWEN_EMAIL и QWEN_PASSWORD в backend/.env",
        )
    if _client is None:
        raise HTTPException(
            status_code=503,
            detail="Браузерный AI-клиент не запущен (Chrome / логин Qwen).",
        )

    prompt = _build_prompt(message, history, graph_context)
    print(f"[AI] ask_llm: user={message[:80]!r} prompt_len={len(prompt)}", flush=True)
    try:
        content = await asyncio.to_thread(_ask_sync, prompt, settings.qwen_timeout)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка web_ai_parser / Qwen: {exc}",
        ) from exc

    if not isinstance(content, str) or not content.strip():
        raise HTTPException(
            status_code=502,
            detail="AI вернул пустой ответ (проверьте логин Qwen, сессию и Chrome).",
        )
    return content.strip()
