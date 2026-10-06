from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import AlertRow
from app.schemas.telemetry import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.scalars(select(AlertRow).order_by(AlertRow.created_at.desc(), AlertRow.id.desc()).limit(max(1, min(limit, 200)))).all()
    return [AlertOut(id=row.id, code=row.code, severity=row.severity, title=row.title, detail=row.detail, timestamp=row.created_at, acknowledged=row.acknowledged) for row in rows]


@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    row = db.get(AlertRow, alert_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    row.acknowledged = True
    db.commit()
    db.refresh(row)
    return AlertOut(id=row.id, code=row.code, severity=row.severity, title=row.title, detail=row.detail, timestamp=row.created_at, acknowledged=row.acknowledged)
