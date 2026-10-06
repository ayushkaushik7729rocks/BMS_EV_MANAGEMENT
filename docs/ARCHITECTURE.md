# EV Guardian AI architecture

## Runtime flow

```text
ESP32 (tomorrow) ──HTTP POST──┐
                              v
Backend mock ─────────────> FastAPI -> Pydantic validation -> SQLite telemetry/alerts
                                             |                    |
                                             v                    v
                                shared ML feature/inference   history/status API
                                             |                    |
                                             └── risk/ETA ────────┘
                                                                  v
                                                   frontend2 vanilla JS polling
```

The mock generator and hardware ingestion use the same validated telemetry payload and persistence service. Fresh hardware samples suppress mock writes for that device, preventing a development simulator from overwriting a live ESP32 feed. The database URL is configurable so SQLite can later be replaced by PostgreSQL without changing route or service code.

## Package ownership

- `frontend2/`: existing static HTML, CSS, JavaScript, and 3D model asset. No framework or build tool is introduced.
- `backend/app/schemas/`: the single telemetry request/response contract.
- `backend/app/api/`: REST routes only.
- `backend/app/services/`: ingestion, continuous mock telemetry, prediction, ETA, risk, and alerts.
- `backend/app/database/`: SQLAlchemy persistence models and SQLite setup.
- `ml/src/features/thermal_features.py`: shared feature transforms used by training and inference.
- `ml/src/preprocessing/`: CALCE download and conversion.
- `ml/src/training/`, `evaluation/`, `inference/`: model lifecycle.

## Thermal safety behavior

ML forecasts the four-sensor average temperature approximately 10 minutes ahead. A deterministic risk service compares the hottest current sensor and the recent hottest-sensor slope with `THERMAL_THRESHOLD_C`; current hottest sensor at/above the configured threshold is `CRITICAL`, and a prediction at/above it is `HIGH`. A rising trend below it is `WARNING`; otherwise it is `NORMAL`. If the threshold is unset, status is `UNCONFIGURED` and ETA is `null`. Since the CALCE model predicts the average, its future value is an advisory signal and does not replace each cell's hardware protection.

The `.env.example` default of 55 C is carried forward from the old UI's demo threshold only. It is not a validated cell limit. Replace it with the battery manufacturer's specified value before connecting hardware. The hardware BMS remains the primary protection mechanism.

## Development services

- SQLite database: `backend/data/bms.sqlite3` by default.
- Mock modes: `NORMAL`, `HIGH_LOAD`, `RISING_TEMPERATURE`, and `THERMAL_WARNING`.
- `COOLING_ACTIVATION_C` controls the demo fan indicator only; it is separate from the battery thermal safety threshold.
- CORS is limited to the localhost origins used by the documented static frontend server.
- Prediction uses a trained CALCE model when `ml/models/thermal_predictor.joblib` exists. Before training, the API labels a simple recent-slope forecast `trend_baseline`; it does not call this ML.
