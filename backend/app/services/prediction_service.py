import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import PROJECT_ROOT, get_settings
from app.database.models import TelemetryRow
from app.services.risk_service import RiskAssessment, assess_thermal_risk, estimate_slope
from app.services.telemetry_service import average_temperature, get_history, max_temperature

ML_ROOT = PROJECT_ROOT / "ml"
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

try:
    from src.inference.predictor import ThermalPredictor
except ImportError:  # Keep the API bootable when optional ML dependencies are unavailable.
    ThermalPredictor = None  # type: ignore[assignment,misc]


class PredictionService:
    def __init__(self):
        settings = get_settings()
        self.threshold_c = settings.thermal_threshold_c
        self.predictor = ThermalPredictor(settings.model_path) if ThermalPredictor else None

    def forecast(self, rows: list[TelemetryRow]) -> tuple[float | None, str]:
        if not rows:
            return None, "unavailable"
        if self.predictor:
            try:
                value = self.predictor.predict_from_rows(rows)
                if value is not None:
                    return float(value), self.predictor.model_name
            except (ValueError, RuntimeError, KeyError):
                pass
        # Honest non-ML trend baseline for demo operation before the CALCE model is trained.
        if len(rows) < 3:
            return None, "unavailable"
        now = rows[-1].timestamp
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        samples = []
        for row in rows:
            timestamp = row.timestamp
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            samples.append(((timestamp - now).total_seconds(), average_temperature(row)))
        recent = [sample for sample in samples if sample[0] >= -600]
        slope = estimate_slope(recent)
        if slope is None:
            return None, "unavailable"
        return round(average_temperature(rows[-1]) + slope * 10, 3), "trend_baseline"

    def assess(self, rows: list[TelemetryRow]) -> tuple[float | None, str, RiskAssessment]:
        latest = rows[-1]
        predicted, source = self.forecast(rows)
        now = latest.timestamp
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        samples = []
        for row in rows:
            stamp = row.timestamp if row.timestamp.tzinfo else row.timestamp.replace(tzinfo=timezone.utc)
            samples.append(((stamp - now).total_seconds(), max_temperature(row)))
        assessment = assess_thermal_risk(max_temperature(latest), predicted, samples, self.threshold_c)
        return predicted, source, assessment


_prediction_service: PredictionService | None = None


def get_prediction_service() -> PredictionService:
    global _prediction_service
    if _prediction_service is None:
        _prediction_service = PredictionService()
    return _prediction_service


def reset_prediction_service() -> None:
    global _prediction_service
    _prediction_service = None
