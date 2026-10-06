from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.schemas.telemetry import ScenarioRequest
from app.services.mock_telemetry_service import SCENARIOS, get_mock_generator

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/scenario")
def current_scenario():
    settings = get_settings()
    if not settings.mock_telemetry_enabled:
        raise HTTPException(status_code=409, detail="Mock telemetry is disabled")
    return {"scenario": get_mock_generator().scenario, "available": list(SCENARIOS), "auto_cycle": settings.mock_auto_cycle}


@router.post("/scenario")
def set_scenario(request: ScenarioRequest):
    settings = get_settings()
    if not settings.mock_telemetry_enabled:
        raise HTTPException(status_code=409, detail="Mock telemetry is disabled")
    generator = get_mock_generator()
    generator.set_scenario(request.scenario)
    return {"scenario": generator.scenario, "auto_cycle": settings.mock_auto_cycle}
