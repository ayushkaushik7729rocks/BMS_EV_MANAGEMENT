from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.database import get_db
from app.schemas.telemetry import (
    AlertOut,
    BatteryStatusResponse,
    CellTemperatures,
    TelemetryHistoryResponse,
    TelemetryPayload,
    TelemetryResponse,
    TemperatureHistoryPoint,
    ThermalPrediction,
)
from app.services.prediction_service import get_prediction_service
from app.services.alert_service import update_alerts
from app.services.risk_service import assess_thermal_risk
from app.services.telemetry_service import (
    average_temperature,
    get_history,
    get_latest,
    max_temperature,
    recent_alerts,
    row_temperatures,
    save_telemetry,
)

router = APIRouter(prefix="/api", tags=["telemetry"])


def as_response(row) -> TelemetryResponse:
    return TelemetryResponse(
        id=row.id, device_id=row.device_id, timestamp=row.timestamp, voltage=row.voltage,
        current=row.current, power=row.power, soc=row.soc, soh=row.soh,
        temperatures=CellTemperatures(**row_temperatures(row)), source=row.source, scenario=row.scenario,
    )


@router.post("/telemetry", response_model=TelemetryResponse, status_code=201)
def ingest_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    row = save_telemetry(db, payload)
    update_alerts(db, payload.device_id)
    return as_response(row)


@router.get("/telemetry/latest", response_model=TelemetryResponse)
def latest_telemetry(device_id: str | None = None, db: Session = Depends(get_db)):
    row = get_latest(db, device_id)
    if row is None:
        raise HTTPException(status_code=404, detail="No telemetry has been received yet")
    return as_response(row)


@router.get("/telemetry/history", response_model=TelemetryHistoryResponse)
def telemetry_history(
    device_id: str | None = None,
    limit: int = Query(default=120, ge=1, le=5000),
    since: datetime | None = None,
    db: Session = Depends(get_db),
):
    rows = get_history(db, limit=limit, device_id=device_id, since=since)
    selected_device = device_id or (rows[-1].device_id if rows else get_settings().device_id)
    return TelemetryHistoryResponse(device_id=selected_device, count=len(rows), items=[as_response(row) for row in rows])


@router.get("/battery/status", response_model=BatteryStatusResponse)
def battery_status(db: Session = Depends(get_db)):
    settings = get_settings()
    rows = get_history(db, limit=settings.history_limit)
    if not rows:
        raise HTTPException(status_code=503, detail="Waiting for the first telemetry sample")
    latest = rows[-1]
    predicted, model_source, risk = get_prediction_service().assess(rows)
    latest_time = latest.timestamp if latest.timestamp.tzinfo else latest.timestamp.replace(tzinfo=timezone.utc)
    heartbeat_seconds = max(30, settings.mock_interval_seconds * 4) if latest.source == "mock" else 30
    connected = datetime.now(timezone.utc) - latest_time <= timedelta(seconds=heartbeat_seconds)
    points = rows[-120:]
    history = [
        TemperatureHistoryPoint(timestamp=row.timestamp, average_temperature_c=round(average_temperature(row), 3), maximum_temperature_c=max_temperature(row))
        for row in points
    ]
    alerts = [
        AlertOut(id=item.id, code=item.code, severity=item.severity, title=item.title, detail=item.detail, timestamp=item.created_at, acknowledged=item.acknowledged)
        for item in recent_alerts(db, latest.device_id)
    ]
    fan_speed = int(min(100, max(0, (max_temperature(latest) - settings.cooling_activation_c) * 8)))
    return BatteryStatusResponse(
        **as_response(latest).model_dump(),
        average_temperature_c=round(average_temperature(latest), 3),
        maximum_temperature_c=round(max_temperature(latest), 3),
        thermal=ThermalPrediction(
            predicted_temperature_10min=predicted,
            prediction_source=model_source,
            risk=risk.risk,
            estimated_time_to_threshold_minutes=risk.eta_minutes,
            threshold_c=settings.thermal_threshold_c,
            explanation=risk.explanation,
        ),
        temperature_history=history,
        alerts=alerts,
        device_connected=connected,
        cooling_active=fan_speed > 0,
        fan_speed_percent=fan_speed,
    )
