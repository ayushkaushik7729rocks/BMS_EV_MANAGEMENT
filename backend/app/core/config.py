from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / "backend" / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "EV Guardian AI API"
    database_url: str = "sqlite:///./data/bms.sqlite3"
    cors_origins: list[str] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    device_id: str = "EVG-001"
    mock_telemetry_enabled: bool = True
    mock_interval_seconds: float = 5.0
    mock_auto_cycle: bool = True
    mock_scenario_seconds: int = 60
    mock_scenario: str = "NORMAL"
    # This is only the old UI's demo value until a cell specification is supplied.
    thermal_threshold_c: float | None = 55.0
    model_path: Path = PROJECT_ROOT / "ml" / "models" / "thermal_predictor.joblib"
    history_limit: int = 600

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("mock_interval_seconds")
    @classmethod
    def positive_interval(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("MOCK_INTERVAL_SECONDS must be positive")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
