from __future__ import annotations

import httpx
from fastapi import HTTPException

from .config import Settings

SYSTEM_PROMPT = """Ты — ассистент приложения GraphModel, среды для мышления графами. Отвечай по-русски, кратко и по делу.

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
            detail="AI не настроен на сервере: задайте AI_API_KEY в backend/.env",
        )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT + (graph_context or "")},
    ]
    for item in history[-8:]:
        role = item.get("role")
        content = (item.get("content") or "")[:1500]
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.ai_api_key.strip()}",
        "HTTP-Referer": settings.ai_http_referer,
        "X-Title": settings.ai_app_title,
        "X-OpenRouter-Title": settings.ai_app_title,
    }
    payload = {
        "model": settings.ai_model.strip(),
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": 4000,
    }

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            res = await client.post(settings.ai_endpoint.strip(), headers=headers, json=payload)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Не удалось связаться с AI-провайдером: {exc}") from exc

    if res.status_code in (401, 403):
        raise HTTPException(status_code=502, detail="Ключ AI-провайдера отклонён (проверьте AI_API_KEY).")
    if res.status_code in (402, 429):
        raise HTTPException(status_code=429, detail="Лимит бесплатного тарифа AI исчерпан — подождите.")
    if res.status_code >= 400:
        detail = ""
        try:
            data = res.json()
            detail = (
                data.get("error", {}).get("message")
                if isinstance(data.get("error"), dict)
                else str(data.get("error") or data.get("message") or "")
            )
        except Exception:
            detail = res.text[:200]
        raise HTTPException(
            status_code=502,
            detail=f"AI-провайдер ответил {res.status_code}" + (f": {detail}" if detail else ""),
        )

    try:
        data = res.json()
        content = data["choices"][0]["message"]["content"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI вернул неожиданный ответ.") from exc

    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail="AI вернул пустой ответ.")
    return content.strip()
