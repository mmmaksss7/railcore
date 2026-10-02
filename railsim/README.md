# RailSim KZ

Диспетчерский симулятор железных дорог Казахстана: карта, поезда, КТСМ, роли и бэкенд с историей.

## Запуск

Терминал 1 — API (шина событий, SQLite, WebSocket):

```bash
cd railsim
python3 backend/app.py
```

Терминал 2 — интерфейс:

```bash
cd railsim
npm install
npm run dev
```

Откройте http://127.0.0.1:5173/

## Бэкенд

| Что | Где |
|---|---|
| Шина (имитация Kafka) | `backend/bus.py`, топики `sim.tick`, `sim.commands`, `sim.events` |
| REST | `/api/state`, `/api/config`, `/api/history/*`, `/api/commands` |
| GraphQL | `POST /graphql` (`config`, `history`, `health`, `kpi`) |
| Онлайн | WebSocket `/ws`, SSE `/api/stream` |
| История 24–72 ч | SQLite `backend/data/railsim.db` |
| Пороги без пересборки | `backend/data/config.yaml` + `PUT /api/config` |
| Health / metrics | `GET /health`, `GET /metrics` |
| Логи | `backend/logs/railsim.log` |

Пороги КТСМ, задержки и перенаправление правятся во вкладке **Пороги** (роль администратор) или в YAML.
