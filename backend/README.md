# Backend

FastAPI telemetry API, SQLite persistence, optional development mock, risk/ETA services, and alert generation. `POST /api/telemetry` is protected by a bearer token by default. The API paths remain unchanged.

## Local setup (Windows PowerShell)

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$token = & .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
(Get-Content .env) -replace '^EV_GUARDIAN_DEVICE_TOKEN=.*$', "EV_GUARDIAN_DEVICE_TOKEN=$token" | Set-Content .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open `http://127.0.0.1:8000/docs` and `http://127.0.0.1:8000/api/health`. Health is public; telemetry POST requires `Authorization: Bearer <token>`. The development server binds to loopback. To run a demo dashboard, explicitly set `MOCK_TELEMETRY_ENABLED=true` in `.env`; mock values carry `source: "mock"`. Set it back to `false` for sensor-free ESP32 smoke tests and physical-device use. Mock mode never disables telemetry ingestion.

For a LAN dashboard, bind the static frontend server to the host's LAN interface, set `window.EV_GUARDIAN_API_BASE` (or the `API_BASE` default in `frontend2/app.js`) to the backend host, and add the exact frontend origin to `CORS_ORIGINS`. Do not expose unauthenticated HTTP telemetry over a shared network. A page served over HTTPS cannot fetch an HTTP API because browsers block that mixed content; use the HTTPS deployment below for remote/LAN production use.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider
```

Alternatively, from the repository root use `backend\.venv\Scripts\python.exe -m pytest -p no:cacheprovider backend\tests`. Tests use an isolated in-memory SQLite database and an explicit test-only token.

## Environment and security

Copy `.env.example` to `.env`. The service refuses to start when `DEVICE_AUTH_ENABLED=true` and `EV_GUARDIAN_DEVICE_TOKEN` is missing or shorter than 32 characters. Generate a token with Python's `secrets.token_urlsafe(32)` and keep it private. `.env` is ignored by Git. Setting `DEVICE_AUTH_ENABLED=false` is only appropriate for isolated loopback development; keep Uvicorn bound to `127.0.0.1` in that case. Authentication is applied to telemetry ingestion; health remains public.

`MOCK_TELEMETRY_ENABLED` defaults to false. Use true only for an explicitly simulated dashboard/demo. Mock samples are labeled `mock`; sensor-free integration fixtures use `test`; only real sensor firmware should send the default `hardware` source. The source label is descriptive, not cryptographic attestation.

The default SQLite database is `backend/data/bms.sqlite3`. Replace the demonstration thermal threshold with values from the actual cell/pack specification before interpreting risk outputs. Cooling output remains an advisory display value.

See `../docs/API.md`, `../docs/ARCHITECTURE.md`, and `../hardware/README.md` for routes, payload, deployment, and ESP32 smoke testing.
