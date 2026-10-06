import numpy as np
import pandas as pd

from app.core.config import Settings
from app.services.mock_telemetry_service import MockTelemetryGenerator, SCENARIOS
from app.services.risk_service import assess_thermal_risk, estimate_slope
from ml.src.features.thermal_features import FEATURE_COLUMNS, TARGET_COLUMN, build_supervised_rows, latest_feature_row
from ml.src.preprocessing.prepare_data import _run_date


def test_mock_telemetry_is_continuous_and_modes_are_available():
    settings = Settings(mock_auto_cycle=False, mock_interval_seconds=5)
    generator = MockTelemetryGenerator(settings)
    first = generator.next_payload()
    second = generator.next_payload()
    assert set(SCENARIOS) == {"NORMAL", "HIGH_LOAD", "RISING_TEMPERATURE", "THERMAL_WARNING"}
    assert abs(second.temperatures.cell_1 - first.temperatures.cell_1) < 1.0
    generator.set_scenario("HIGH_LOAD")
    assert generator.next_payload().current > first.current


def _run_frame(seconds=1600):
    time = np.arange(seconds, dtype=float)
    temp = 30 + .004 * time + .000002 * time**2
    return pd.DataFrame({
        "time_seconds": time,
        "temperature_c": temp,
        "voltage_v": 3.9 - time * 1e-5,
        "current_a": 2 + time * 1e-4,
        "power_w": (3.9 - time * 1e-5) * (2 + time * 1e-4),
    })


def test_feature_engineering_builds_plus_ten_minute_target_without_future_inputs():
    frame = _run_frame()
    features = build_supervised_rows(frame)
    assert set(FEATURE_COLUMNS).issubset(features.columns)
    assert TARGET_COLUMN in features
    row = features.loc[features.time_seconds == 600].iloc[0]
    assert row[TARGET_COLUMN] > row.temperature_c
    changed = frame.copy()
    changed.loc[changed.time_seconds > 900, "temperature_c"] += 100
    altered_features = build_supervised_rows(changed)
    original = features.loc[features.time_seconds == 600, FEATURE_COLUMNS].iloc[0]
    altered = altered_features.loc[altered_features.time_seconds == 600, FEATURE_COLUMNS].iloc[0]
    pd.testing.assert_series_equal(original, altered)


def test_inference_reuses_training_feature_transform_and_requires_history():
    short = [{"time_seconds": float(i), "temperature_c": 30 + i * .01, "voltage_v": 3.9, "current_a": 1.0, "power_w": 3.9} for i in range(60)]
    assert latest_feature_row(short) is None
    history = [{"time_seconds": float(i * 5), "temperature_c": 30 + i * .01, "voltage_v": 3.9, "current_a": 1.0, "power_w": 3.9} for i in range(80)]
    latest = latest_feature_row(history)
    assert latest is not None and list(latest.columns) == FEATURE_COLUMNS


def test_risk_engine_covers_normal_warning_high_critical_and_unconfigured():
    flat = [(0, 30.0), (30, 30.0), (60, 30.0)]
    rising = [(0, 30.0), (30, 31.0), (60, 32.0)]
    assert assess_thermal_risk(30, 31, flat, 55).risk == "NORMAL"
    warning = assess_thermal_risk(32, 40, rising, 55)
    assert warning.risk == "WARNING" and warning.eta_minutes is not None
    assert assess_thermal_risk(45, 56, rising, 55).risk == "HIGH"
    assert assess_thermal_risk(55, 55, rising, 55).risk == "CRITICAL"
    assert assess_thermal_risk(32, None, rising, None).risk == "UNCONFIGURED"


def test_eta_is_null_without_rising_slope():
    flat = [(0, 30.0), (30, 30.0), (60, 30.0)]
    assert estimate_slope(flat) == 0
    assert assess_thermal_risk(30, 30, flat, 55).eta_minutes is None


def test_calce_filename_dates_allow_archive_suffixes():
    assert _run_date("25degC_10times_CX2_4_01_02_13.txt") == "2013-01-02"
    assert _run_date("35degC_10times_CX2_4_10_27_11_part1.txt") == "2011-10-27"
    assert _run_date("25degC_10times_CX2_4_4_18_12_chamber_acting weird.txt") == "2012-04-18"
