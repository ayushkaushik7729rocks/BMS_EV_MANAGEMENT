import asyncio
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.database import SessionLocal
from app.schemas.telemetry import CellTemperatures, TelemetryPayload
from app.services.alert_service import update_alerts
from app.services.telemetry_service import get_latest, save_telemetry

SCENARIOS = ("NORMAL", "HIGH_LOAD", "RISING_TEMPERATURE", "THERMAL_WARNING")
_generator: "MockTelemetryGenerator | None" = None


class MockTelemetryGenerator:
    """Stateful demo source; values vary continuously and are never used as CALCE training data."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.scenario = settings.mock_scenario if settings.mock_scenario in SCENARIOS else "NORMAL"
        self.started_at = time.monotonic()
        self.tick = 0
        self.temperatures = [31.0, 31.2, 30.8, 31.1]
        self.soc = 78.0

    def set_scenario(self, scenario: str) -> None:
        if scenario not in SCENARIOS:
            raise ValueError(f"Unsupported mock scenario: {scenario}")
        self.scenario = scenario
        self.started_at = time.monotonic()

    def next_payload(self) -> TelemetryPayload:
        self.tick += 1
        if self.settings.mock_auto_cycle and time.monotonic() - self.started_at >= self.settings.mock_scenario_seconds:
            index = (SCENARIOS.index(self.scenario) + 1) % len(SCENARIOS)
            self.scenario = SCENARIOS[index]
            self.started_at = time.monotonic()
        mode = self.scenario
        current_by_mode = {"NORMAL": 2.4, "HIGH_LOAD": 8.0, "RISING_TEMPERATURE": 4.5, "THERMAL_WARNING": 7.0}
        slope_by_mode = {"NORMAL": -0.001, "HIGH_LOAD": 0.004, "RISING_TEMPERATURE": 0.012, "THERMAL_WARNING": 0.035}
        current = current_by_mode[mode] + 0.08 * ((self.tick % 5) - 2)
        rise = slope_by_mode[mode] * self.settings.mock_interval_seconds
        self.temperatures = [max(20.0, temp + rise + offset) for temp, offset in zip(self.temperatures, (0.002, 0.0, -0.001, 0.001))]
        voltage = max(3.2, 3.94 - current * 0.012)
        power = round(voltage * current, 3)
        average = sum(self.temperatures) / 4
        fan_speed = int(min(100, max(0, (average - 34) * 8)))
        return TelemetryPayload(
            device_id=self.settings.device_id,
            timestamp=datetime.now(timezone.utc),
            voltage=round(voltage, 3),
            current=round(current, 3),
            power=power,
            soc=round(self.soc, 2),
            soh=96.4,
            temperatures=CellTemperatures(**{f"cell_{i+1}": round(value, 3) for i, value in enumerate(self.temperatures)}),
            source="mock",
            scenario=mode,
        )


def get_mock_generator(settings: Settings | None = None) -> MockTelemetryGenerator:
    global _generator
    if _generator is None:
        _generator = MockTelemetryGenerator(settings or get_settings())
    return _generator


async def run_mock_telemetry(generator: MockTelemetryGenerator | None = None) -> None:
    generator = generator or get_mock_generator()
    while True:
        db: Session = SessionLocal()
        try:
            latest = get_latest(db, generator.settings.device_id)
            if latest and latest.source == "hardware":
                stamp = latest.timestamp if latest.timestamp.tzinfo else latest.timestamp.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - stamp).total_seconds()
                if age <= max(30.0, generator.settings.mock_interval_seconds * 4):
                    await asyncio.sleep(generator.settings.mock_interval_seconds)
                    continue
            save_telemetry(db, generator.next_payload())
            update_alerts(db, generator.settings.device_id)
        finally:
            db.close()
        await asyncio.sleep(generator.settings.mock_interval_seconds)
