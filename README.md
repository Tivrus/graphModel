# GraphModel

Интерактивная многомерная графовая модель — рабочая среда для мышления структурами.

## Архитектура

| Режим | Как | AI |
|-------|-----|----|
| **Локально** | только фронт (`npm run dev` / Electron) | нет |
| **Онлайн** | фронт + Python backend | да (ключ в `backend/.env`) |

Фронт: Vite · React · TypeScript · three.js  
Бэк: FastAPI · прокси к OpenRouter (+ `finger_remote_controller` для жестов)

## Быстрый старт — локально (без AI)

```bash
npm install
npm run dev
```

## Онлайн с AI

```bash
# 1) backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# впишите AI_API_KEY=sk-or-…  (https://openrouter.ai/keys)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 2) фронт (другой терминал, из корня)
npm run dev
```

Или из корня после установки venv: `npm run backend`.

В статусбаре появится бейдж **онлайн+AI**. Ключ API на фронт не попадает.

## Окно Electron

```bash
npm run desktop
```

## Возможности

- 3 слота проектов, 3D/2D, планеты, кластеры/подгруппы, картинки
- AI-чат через backend (генерация графов)
- Локальные жесты: `backend/src/finger_remote_controller`
