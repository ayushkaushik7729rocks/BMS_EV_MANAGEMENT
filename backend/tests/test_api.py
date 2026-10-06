from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.database.models import TelemetryRow
from app.main import create_app
from app.schemas.telemetry import TelemetryPayload
from app.services.telemetry_service import get_latest
from tests.conftest import insert_series


def test_fastapi_startup_and_health():
    app = create_app(Settings(mock_telemetry_enabled=False), initialize_database=False)
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_telemetry_schema_accepts_payload(telemetry_payload):
    parsed = TelemetryPayload.model_validate(telemetry_payload)
    assert parsed.device_id == "EVG-TEST"
    assert parsed.power is None


def test_telemetry_schema_rejects_bad_soc(telemetry_payload):
    telemetry_payload["soc"] = 101
    try:
        TelemetryPayload.model_validate(telemetry_payload)
    except Exception as error:
        assert "soc" in str(error)
    else:
        raise AssertionError("Out-of-range SOC should fail Pydantic validation")


def test_post_telemetry_computes_power_and_stores(client, telemetry_payload):
    response = client.post("/api/telemetry", json=telemetry_payload)
    assert response.status_code == 201
    body = response.json()
    assert body["power"] == 7.8
    assert body["source"] == "hardware"


def test_database_storage_and_latest_endpoint(client, telemetry_payload, db_session_factory):
    client.post("/api/telemetry", json=telemetry_payload)
    with db_session_factory() as db:
        latest = get_latest(db, "EVG-TEST")
        assert isinstance(latest, TelemetryRow)
        assert latest.cell_4_temperature == 33.0
    response = client.get("/api/telemetry/latest?device_id=EVG-TEST")
    assert response.status_code == 200
    assert response.json()["device_id"] == "EVG-TEST"


def test_history_returns_chronological_samples(client, telemetry_payload):
    for index in range(3):
        payload = {**telemetry_payload, "timestamp": datetime.now(timezone.utc).isoformat(), "voltage": 3.9 - index * .01}
        client.post("/api/telemetry", json=payload)
    response = client.get("/api/telemetry/history?device_id=EVG-TEST&limit=2")
    assert response.status_code == 200
    assert response.json()["count"] == 2
    values = [row["voltage"] for row in response.json()["items"]]
    assert values[0] > values[1]


def test_battery_status_includes_thermal_and_history(client, db_session_factory):
    insert_series(db_session_factory)
    response = client.get("/api/battery/status")
    assert response.status_code == 200
    body = response.json()
    assert len(body["temperature_history"]) >= 60
    assert body["thermal"]["risk"] == "WARNING"
    assert body["thermal"]["estimated_time_to_threshold_minutes"] is not None


def test_alert_list_endpoint(client, telemetry_payload):
    client.post("/api/telemetry", json=telemetry_payload)
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
