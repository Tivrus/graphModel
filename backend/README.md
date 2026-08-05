# GraphModel Backend

Python API для онлайн-режима (AI через браузерный клиент Qwen). Фронтенд без бэкенда работает **локально без AI**.

## Быстрый старт

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# впишите QWEN_EMAIL и QWEN_PASSWORD (аккаунт chat.qwen.ai)

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Нужны: Google Chrome и пакет `web_ai_parser` в venv (`site-packages/web_ai_parser`).

Из корня проекта:

```bash
npm run backend
```

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | доступность бэкенда и AI |
| POST | `/api/ai/chat` | чат / генерация графа |

Учётные данные Qwen хранятся только в `backend/.env`, не на фронте. При старте сервер поднимает Chrome через Selenium; без логина AI недоступен.

## Локальные жесты

Пакет `src/finger_remote_controller` — MediaPipe Hands, работает офлайн.
Установка drop-in: `python scripts/install_dropin.py`.
