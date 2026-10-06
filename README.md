# EV Guardian AI

Smart predictive battery monitoring software for the BMS_AI_project. The existing `frontend2` remains plain HTML, CSS, and JavaScript. FastAPI supplies telemetry and alerts; a separately trained model predicts battery temperature from CALCE cycling traces.

## Run locally

Open two PowerShell terminals in the repository folder.

**Terminal 1 - backend:**

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
python -m uvicorn app.main:app --reload
```

**Terminal 2 - existing frontend:**

```powershell
cd frontend2
python -m http.server 5500
```

Visit `http://127.0.0.1:5500`. The dashboard requests the backend at `http://127.0.0.1:8000`; set `window.EV_GUARDIAN_API_BASE` before loading to override the API base. Interactive API docs are at `http://127.0.0.1:8000/docs`.

Mock telemetry is enabled by default and stored in local SQLite at `backend/data/bms.sqlite3`. The service runs without an ESP32. CALCE model training is a separate step.

## CALCE model

The official `CX2_4.zip` archive is expected at `ml/data/raw/CX2_4.zip` and is ignored by Git. With the backend virtual environment active:

```powershell
cd ml
python -m src.preprocessing.prepare_data
python -m src.training.train_model
python -m src.evaluation.evaluate_model
```

Training writes `ml/models/thermal_predictor.joblib` and measured split details/metrics to `ml/models/metrics.json`. The model and report are shareable; raw and processed source data remain untracked. See [ML pipeline](docs/ML_PIPELINE.md) for source scope, features, horizon, split method, and current results.

## Tests

```powershell
cd backend
python -m pytest
```

## Project map

- `frontend2/` - preserved vanilla dashboard; telemetry comes from the API.
- `backend/` - FastAPI, validation, SQLite persistence, mock generator, alerts, and thermal risk.
- `ml/` - CALCE ingestion, feature building, model comparison, and inference.
- `hardware/` - reserved for later ESP32 integration.
- `docs/` - architecture, API, and ML pipeline notes.

The model is advisory only. The hardware BMS and cell manufacturer limits remain the protection authority. Set `THERMAL_THRESHOLD_C` from the actual battery specification before using threshold-based displays or hardware actions; the example value is only a demo setting.
