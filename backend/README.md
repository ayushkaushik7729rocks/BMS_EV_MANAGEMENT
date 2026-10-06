# Backend

FastAPI telemetry API, SQLite persistence, mock source, risk/ETA services, and alert generation. The REST API accepts future ESP32 messages at `POST /api/telemetry`.

## Setup (Windows PowerShell)

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. Mock telemetry starts automatically and persists every five seconds. It cycles through four scenarios every minute by default. Use `POST /api/demo/scenario` to select a scenario; set `MOCK_AUTO_CYCLE=false` in `.env` to keep that mode active.

## Tests

```powershell
python -m pytest
```

The backend and ML requirements are installed together through `requirements.txt`; the virtual environment remains under `backend/.venv` and is ignored by Git.

## Configuration

Copy `.env.example` to `.env`. SQLite is the default. `THERMAL_THRESHOLD_C=55.0` is only the prior UI's demonstration value, not a verified cell safety limit. Replace it with the pack/cell specification before hardware operation. If unset, the risk engine returns `UNCONFIGURED` and no ETA.

See `../docs/API.md` and `../docs/ARCHITECTURE.md` for routes, data contract, and persistence details.
