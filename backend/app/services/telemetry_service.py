from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.database.models import AlertRow, TelemetryRow
from app.schemas.telemetry import TelemetryPayload


def average_temperature(row: TelemetryRow) -> float:
    return sum((row.cell_1_temperature, row.cell_2_temperature, row.cell_3_temperature, row.cell_4_temperature)) / 4.0


def max_temperature(row: TelemetryRow) -> float:
    return max(row.cell_1_temperature, row.cell_2_temperature, row.cell_3_temperature, row.cell_4_temperature)


def row_temperatures(row: TelemetryRow) -> dict[str, float]:
    return {
        "cell_1": row.cell_1_temperature,
        "cell_2": row.cell_2_temperature,
        "cell_3": row.cell_3_temperature,
        "cell_4": row.cell_4_temperature,
    }


def save_telemetry(db: Session, payload: TelemetryPayload) -> TelemetryRow:
    now = payload.timestamp or datetime.now(timezone.utc)
    temps = payload.temperatures
    row = TelemetryRow(
        device_id=payload.device_id,
        timestamp=now,
        voltage=payload.voltage,
        current=payload.current,
        power=payload.power if payload.power is not None else payload.voltage * payload.current,
        soc=payload.soc,
        soh=payload.soh,
        cell_1_temperature=temps.cell_1,
        cell_2_temperature=temps.cell_2,
        cell_3_temperature=temps.cell_3,
        cell_4_temperature=temps.cell_4,
        source=payload.source,
        scenario=payload.scenario,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_latest(db: Session, device_id: str | None = None) -> TelemetryRow | None:
    query = select(TelemetryRow).order_by(desc(TelemetryRow.timestamp), desc(TelemetryRow.id))
    if device_id:
        query = query.where(TelemetryRow.device_id == device_id)
    return db.scalar(query.limit(1))


def get_history(db: Session, limit: int = 120, device_id: str | None = None, since: datetime | None = None) -> list[TelemetryRow]:
    query = select(TelemetryRow).order_by(desc(TelemetryRow.timestamp), desc(TelemetryRow.id))
    if device_id:
        query = query.where(TelemetryRow.device_id == device_id)
    if since:
        query = query.where(TelemetryRow.timestamp >= since)
    rows = list(db.scalars(query.limit(limit)).all())
    return list(reversed(rows))


def recent_alerts(db: Session, device_id: str, limit: int = 20) -> list[AlertRow]:
    query = select(AlertRow).where(AlertRow.device_id == device_id).order_by(desc(AlertRow.created_at), desc(AlertRow.id)).limit(limit)
    return list(db.scalars(query).all())


def record_alert(db: Session, device_id: str, code: str, severity: str, title: str, detail: str) -> AlertRow:
    active = db.scalar(select(AlertRow).where(AlertRow.device_id == device_id, AlertRow.code == code, AlertRow.resolved_at.is_(None)).order_by(desc(AlertRow.id)).limit(1))
    if active:
        return active
    alert = AlertRow(device_id=device_id, code=code, severity=severity, title=title, detail=detail)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def resolve_alerts_except(db: Session, device_id: str, active_codes: set[str]) -> None:
    rows = db.scalars(select(AlertRow).where(AlertRow.device_id == device_id, AlertRow.resolved_at.is_(None))).all()
    now = datetime.now(timezone.utc)
    changed = False
    for row in rows:
        if row.code not in active_codes:
            row.resolved_at = now
            changed = True
    if changed:
        db.commit()
