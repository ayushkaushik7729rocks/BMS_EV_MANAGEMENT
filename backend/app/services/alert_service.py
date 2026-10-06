from sqlalchemy.orm import Session

from app.services.prediction_service import get_prediction_service
from app.services.telemetry_service import get_history, max_temperature, record_alert, resolve_alerts_except


def update_alerts(db: Session, device_id: str) -> None:
    rows = get_history(db, limit=600, device_id=device_id)
    if not rows:
        return
    latest = rows[-1]
    _, _, assessment = get_prediction_service().assess(rows)
    active: set[str] = set()
    risk = assessment.risk
    if risk in {"WARNING", "HIGH", "CRITICAL"}:
        code = f"thermal_{risk.lower()}"
        active.add(code)
        severity = "critical" if risk == "CRITICAL" else "warning"
        record_alert(db, device_id, code, severity, f"Thermal risk: {risk.lower()}", assessment.explanation)
    if max_temperature(latest) > 34.0:
        active.add("cooling_active")
        record_alert(db, device_id, "cooling_active", "info", "Cooling response active", "Temperature driven cooling response is above its demo activation point.")
    resolve_alerts_except(db, device_id, active)
