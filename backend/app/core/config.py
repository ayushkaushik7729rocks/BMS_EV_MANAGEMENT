import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / "backend" / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "EV Guardian AI API"
    database_url: str = "sqlite:///./data/bms.sqlite3"
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    device_id: str = "EVG-001"
    device_auth_enabled: bool = True
    device_token: SecretStr | None = Field(default=None, validation_alias="EV_GUARDIAN_DEVICE_TOKEN")
    mock_telemetry_enabled: bool = False
    mock_interval_seconds: float = 5.0
    mock_auto_cycle: bool = True
    mock_scenario_seconds: int = 60
    mock_scenario: str = "NORMAL"
    # This is only the old UI's demo value until a cell specification is supplied.
    thermal_threshold_c: float | None = 55.0
    # Development fan output only; replace with the cooling controller's specification.
    cooling_activation_c: float = 34.0
    model_path: Path = PROJECT_ROOT / "ml" / "models" / "thermal_predictor.joblib"
    history_limit: int = 600

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value):
        if isinstance(value, str):
            if value.lstrip().startswith("["):
                parsed = json.loads(value)
                if not isinstance(parsed, list):
                    raise ValueError("CORS_ORIGINS JSON value must be an array")
                return parsed
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
