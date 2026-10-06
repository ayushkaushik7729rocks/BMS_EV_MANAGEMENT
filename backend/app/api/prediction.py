from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.services.prediction_service import get_prediction_service
from app.services.telemetry_service import get_history

router = APIRouter(prefix="/api/prediction", tags=["prediction"])


@router.get("/latest")
def latest_prediction():
    db: Session = SessionLocal()
    try:
        rows = get_history(db, limit=600)
        if not rows:
            raise HTTPException(status_code=404, detail="No telemetry is available for prediction")
        value, source, risk = get_prediction_service().assess(rows)
        return {
            "predicted_temperature_10min": value,
            "prediction_source": source,
            "thermal_risk": risk.risk,
            "estimated_time_to_threshold_minutes": risk.eta_minutes,
        }
    finally:
        db.close()
