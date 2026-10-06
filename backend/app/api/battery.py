from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.telemetry import battery_status
from app.database.database import get_db

router = APIRouter(prefix="/api/battery", tags=["battery"])


@router.get("/status")
def unified_battery_status(db: Session = Depends(get_db)):
    return battery_status(db)
