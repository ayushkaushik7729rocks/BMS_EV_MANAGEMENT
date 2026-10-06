from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ScenarioName = Literal["NORMAL", "HIGH_LOAD", "RISING_TEMPERATURE", "THERMAL_WARNING"]
RiskName = Literal["NORMAL", "WARNING", "HIGH", "CRITICAL", "UNCONFIGURED"]


class CellTemperatures(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cell_1: float
    cell_2: float
    cell_3: float
    cell_4: float

    @field_validator("cell_1", "cell_2", "cell_3", "cell_4")
    @classmethod
    def plausible_sensor_reading(cls, value: float) -> float:
        if not -55 <= value <= 150:
            raise ValueError("temperature is outside the sensor's documented measurement range")
        return value


class TelemetryPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str = Field(min_length=1, max_length=80)
    timestamp: datetime | None = None
    voltage: float = Field(gt=0, allow_inf_nan=False)
    current: float = Field(allow_inf_nan=False)
    power: float | None = Field(default=None, allow_inf_nan=False)
    soc: float = Field(ge=0, le=100, allow_inf_nan=False)
    soh: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    temperatures: CellTemperatures
    source: Literal["hardware", "mock"] = "hardware"
    scenario: ScenarioName | None = None

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime | None) -> datetime | None:
        if value and value.tzinfo is None:
            return value.replace(tzinfo=None)
        return value


class AlertOut(BaseModel):
    id: int
    code: str
    severity: Literal["info", "warning", "critical"]
    title: str
    detail: str
    timestamp: datetime
    acknowledged: bool


class TemperatureHistoryPoint(BaseModel):
    timestamp: datetime
    average_temperature_c: float
    maximum_temperature_c: float


class ThermalPrediction(BaseModel):
    predicted_temperature_10min: float | None
    prediction_source: str
    risk: RiskName
    estimated_time_to_threshold_minutes: float | None
    threshold_c: float | None
    explanation: str


class TelemetryResponse(BaseModel):
    id: int
    device_id: str
    timestamp: datetime
    voltage: float
    current: float
    power: float
    soc: float
    soh: float | None
    temperatures: CellTemperatures
    source: Literal["hardware", "mock"]
    scenario: ScenarioName | None


class BatteryStatusResponse(TelemetryResponse):
    average_temperature_c: float
    maximum_temperature_c: float
    thermal: ThermalPrediction
    temperature_history: list[TemperatureHistoryPoint]
    alerts: list[AlertOut]
    device_connected: bool
    cooling_active: bool
    fan_speed_percent: int


class TelemetryHistoryResponse(BaseModel):
    device_id: str
    count: int
    items: list[TelemetryResponse]


class ScenarioRequest(BaseModel):
    scenario: ScenarioName
