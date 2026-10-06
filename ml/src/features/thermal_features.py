from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "temperature_c",
    "temperature_mean_60s_c",
    "temperature_std_60s_c",
    "temperature_delta_60s_c",
    "temperature_slope_c_per_min",
    "temperature_lag_300s_c",
    "voltage_v",
    "current_a",
    "power_w",
    "current_delta_60s_a",
]
TARGET_COLUMN = "target_temperature_10min_c"


def _clean_run(frame: pd.DataFrame) -> pd.DataFrame:
    required = {"time_seconds", "temperature_c", "voltage_v", "current_a"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Missing thermal input columns: {sorted(missing)}")
    clean = frame.copy()
    clean = clean.sort_values("time_seconds").drop_duplicates("time_seconds", keep="last")
    for name in required:
        clean[name] = pd.to_numeric(clean[name], errors="coerce")
    clean = clean.dropna(subset=["time_seconds", "temperature_c", "voltage_v", "current_a"])
    clean = clean[np.isfinite(clean[list(required)].to_numpy()).all(axis=1)]
    if "power_w" not in clean:
        clean["power_w"] = clean["voltage_v"] * clean["current_a"]
    else:
        clean["power_w"] = pd.to_numeric(clean["power_w"], errors="coerce").fillna(clean["voltage_v"] * clean["current_a"])
    clean = clean.reset_index(drop=True)
    return clean


def _feature_frame(run: pd.DataFrame) -> pd.DataFrame:
    times = run["time_seconds"].to_numpy(dtype=float)
    temperatures = run["temperature_c"].to_numpy(dtype=float)
    currents = run["current_a"].to_numpy(dtype=float)
    index = pd.to_timedelta(times, unit="s")
    temperature_series = pd.Series(temperatures, index=index)
    current_series = pd.Series(currents, index=index)
    rolling_temp = temperature_series.rolling("60s", min_periods=1).mean()
    rolling_std = temperature_series.rolling("60s", min_periods=2).std().fillna(0.0)
    past_60 = np.searchsorted(times, times - 60.0, side="right") - 1
    past_300 = np.searchsorted(times, times - 300.0, side="right") - 1
    past_60 = np.clip(past_60, 0, len(times) - 1)
    past_300 = np.clip(past_300, 0, len(times) - 1)
    elapsed_60 = np.maximum(times - times[past_60], 1.0)
    return pd.DataFrame({
        "temperature_c": temperatures,
        "temperature_mean_60s_c": rolling_temp.to_numpy(),
        "temperature_std_60s_c": rolling_std.to_numpy(),
        "temperature_delta_60s_c": temperatures - temperatures[past_60],
        "temperature_slope_c_per_min": (temperatures - temperatures[past_60]) * 60.0 / elapsed_60,
        "temperature_lag_300s_c": temperatures[past_300],
        "voltage_v": run["voltage_v"].to_numpy(dtype=float),
        "current_a": currents,
        "power_w": run["power_w"].to_numpy(dtype=float),
        "current_delta_60s_a": currents - current_series.to_numpy()[past_60],
    }, columns=FEATURE_COLUMNS)


def build_supervised_rows(run: pd.DataFrame, horizon_minutes: float = 10.0) -> pd.DataFrame:
    """Create rows using only current/past values and a future temperature label.

    The future row is selected by elapsed time, not a fixed row count. The input
    history starts at least 300 seconds before each prediction point.
    """
    clean = _clean_run(run)
    if len(clean) < 4:
        return pd.DataFrame(columns=[*FEATURE_COLUMNS, TARGET_COLUMN, "time_seconds"])
    times = clean["time_seconds"].to_numpy(dtype=float)
    target_times = times + horizon_minutes * 60.0
    right = np.searchsorted(times, target_times, side="left")
    left = np.clip(right - 1, 0, len(times) - 1)
    right_clamped = np.clip(right, 0, len(times) - 1)
    use_right = np.abs(times[right_clamped] - target_times) < np.abs(times[left] - target_times)
    future_indices = np.where(use_right, right_clamped, left)
    intervals = np.diff(times)
    interval = float(np.median(intervals[intervals > 0])) if np.any(intervals > 0) else 1.0
    tolerance = max(5.0 * interval, horizon_minutes * 60.0 * 0.03)
    valid = (times - times[0] >= 300.0) & (right < len(times)) & (np.abs(times[future_indices] - target_times) <= tolerance)
    features = _feature_frame(clean)
    rows = features.loc[valid].copy()
    rows[TARGET_COLUMN] = clean["temperature_c"].to_numpy()[future_indices[valid]]
    rows["time_seconds"] = times[valid]
    return rows.reset_index(drop=True)


def latest_feature_row(history: list[dict], horizon_minutes: float = 10.0) -> pd.DataFrame | None:
    """Transform recent API/DB samples using the same training feature code."""
    if len(history) < 3:
        return None
    frame = pd.DataFrame(history)
    if "time_seconds" not in frame:
        stamps = pd.to_datetime(frame["timestamp"], utc=True)
        frame["time_seconds"] = (stamps - stamps.iloc[0]).dt.total_seconds()
    times = pd.to_numeric(frame["time_seconds"], errors="coerce")
    if times.notna().sum() < 3 or times.max() - times.min() < 300.0:
        return None
    if "temperature_c" not in frame:
        temp_cols = [name for name in ("cell_1_temperature", "cell_2_temperature", "cell_3_temperature", "cell_4_temperature") if name in frame]
        if temp_cols:
            frame["temperature_c"] = frame[temp_cols].mean(axis=1)
        elif "average_temperature_c" in frame:
            frame["temperature_c"] = frame["average_temperature_c"]
        else:
            return None
    feature_frame = _feature_frame(_clean_run(frame))
    if len(feature_frame) == 0:
        return None
    return feature_frame.loc[[feature_frame.index[-1]], FEATURE_COLUMNS]
