from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.main import create_app
from app.core.config import Settings
from app.services.prediction_service import reset_prediction_service


@pytest.fixture
def db_session_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(db_session_factory):
    app = create_app(Settings(mock_telemetry_enabled=False), initialize_database=False)

    def override_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    reset_prediction_service()


@pytest.fixture
def telemetry_payload():
    return {
        "device_id": "EVG-TEST",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "voltage": 3.9,
        "current": 2.0,
        "soc": 75.0,
        "temperatures": {"cell_1": 30.0, "cell_2": 31.0, "cell_3": 32.0, "cell_4": 33.0},
    }


def insert_series(db_session_factory, count: int = 85, interval_seconds: int = 5):
    from app.schemas.telemetry import TelemetryPayload
    from app.schemas.telemetry import CellTemperatures
    from app.services.telemetry_service import save_telemetry

    now = datetime.now(timezone.utc)
    with db_session_factory() as db:
        rows = []
        for i in range(count):
            temp = 30 + i * 0.006
            payload = TelemetryPayload(
                device_id="EVG-TEST",
                timestamp=now - timedelta(seconds=(count - i) * interval_seconds),
                voltage=3.9 - i * 0.0001,
                current=2.0,
                soc=75.0,
                soh=96.0,
                source="mock",
                scenario="RISING_TEMPERATURE",
                temperatures=CellTemperatures(cell_1=temp, cell_2=temp + .2, cell_3=temp - .1, cell_4=temp + .1),
            )
            rows.append(save_telemetry(db, payload))
        return rows
