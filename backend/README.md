# GraphModel Backend

Python API для онлайн-режима (AI). Фронтенд без бэкенда работает **локально без AI**.

## Быстрый старт

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# впишите AI_API_KEY (OpenRouter: https://openrouter.ai/keys)

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Из корня проекта:

```bash
npm run backend
```

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | доступность бэкенда и AI |
| POST | `/api/ai/chat` | чат / генерация графа |

Ключ провайдера хранится только в `backend/.env`, не на фронте.

## Локальные жесты

Пакет `src/finger_remote_controller` — MediaPipe Hands, работает офлайн.
Установка drop-in: `python scripts/install_dropin.py`.
