from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

from src.features.thermal_features import FEATURE_COLUMNS, TARGET_COLUMN
from src.preprocessing.prepare_data import OUTPUT, prepare_dataset

ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = ROOT / "ml" / "models"
MODEL_PATH = MODEL_DIR / "thermal_predictor.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"


def chronological_group_split(frame: pd.DataFrame) -> tuple[set[str], set[str], set[str]]:
    groups = frame[["group_id", "run_date", "source_file", "cycle_id"]].drop_duplicates().sort_values(
        ["run_date", "source_file", "cycle_id"], kind="stable"
    )["group_id"].tolist()
    if len(groups) < 3:
        raise ValueError(f"Need at least 3 independent chronological cycle groups; found {len(groups)}.")
    train_end = max(1, int(len(groups) * 0.70))
    validation_end = max(train_end + 1, int(len(groups) * 0.85))
    validation_end = min(validation_end, len(groups) - 1)
    return set(groups[:train_end]), set(groups[train_end:validation_end]), set(groups[validation_end:])


def metrics_for(model, X: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    prediction = model.predict(X)
    return {
        "mae_c": float(mean_absolute_error(y, prediction)),
        "rmse_c": float(np.sqrt(mean_squared_error(y, prediction))),
        "r2": float(r2_score(y, prediction)) if len(y) >= 2 else float("nan"),
    }


def load_dataset() -> pd.DataFrame:
    if not OUTPUT.exists():
        return prepare_dataset()
    frame = pd.read_csv(OUTPUT)
    required = {*FEATURE_COLUMNS, TARGET_COLUMN, "group_id", "run_date", "source_file", "cycle_id"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Processed CALCE file is missing columns: {sorted(missing)}. Re-run prepare_data.")
    return frame


def main() -> dict:
    frame = load_dataset().dropna(subset=[*FEATURE_COLUMNS, TARGET_COLUMN]).copy()
    train_groups, validation_groups, test_groups = chronological_group_split(frame)
    train = frame[frame.group_id.isin(train_groups)]
    validation = frame[frame.group_id.isin(validation_groups)]
    test = frame[frame.group_id.isin(test_groups)]
    if min(len(train), len(validation), len(test)) == 0:
        raise ValueError("Time-aware split produced an empty partition; inspect CALCE run/cycle groups.")
    X_train, y_train = train[FEATURE_COLUMNS], train[TARGET_COLUMN]
    X_validation, y_validation = validation[FEATURE_COLUMNS], validation[TARGET_COLUMN]
    X_test, y_test = test[FEATURE_COLUMNS], test[TARGET_COLUMN]

    candidates = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=160, min_samples_leaf=2, max_features=0.9, n_jobs=-1, random_state=42),
        "xgboost": XGBRegressor(n_estimators=220, max_depth=4, learning_rate=0.04, subsample=0.85, colsample_bytree=0.9, reg_lambda=1.0, objective="reg:squarederror", n_jobs=-1, random_state=42),
    }
    validation_metrics = {}
    fitted = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        fitted[name] = model
        validation_metrics[name] = metrics_for(model, X_validation, y_validation)
        print(f"{name} validation: {validation_metrics[name]}")
    selected_name = min(validation_metrics, key=lambda name: validation_metrics[name]["mae_c"])
    selected = candidates[selected_name]
    selected.fit(pd.concat([X_train, X_validation]), pd.concat([y_train, y_validation]))
    test_metrics = metrics_for(selected, X_test, y_test)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": selected,
        "model_name": selected_name,
        "feature_columns": FEATURE_COLUMNS,
        "horizon_minutes": 10.0,
        "dataset": "CALCE CX2_4 source data",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    }, MODEL_PATH)
    report = {
        "dataset": "CALCE CX2_4 official archive; source data/*.txt; no generated rows used",
        "target": TARGET_COLUMN,
        "horizon_minutes": 10,
        "features": FEATURE_COLUMNS,
        "split_method": "chronological whole-file/cycle groups sorted by CALCE filename date; no random split; target windows do not cross Pgm cycle groups",
        "split_group_counts": {"train": len(train_groups), "validation": len(validation_groups), "test": len(test_groups)},
        "split_sample_counts": {"train": len(train), "validation": len(validation), "test": len(test)},
        "date_ranges": {
            "train": [train.run_date.min(), train.run_date.max()],
            "validation": [validation.run_date.min(), validation.run_date.max()],
            "test": [test.run_date.min(), test.run_date.max()],
        },
        "validation_metrics": validation_metrics,
        "selected_model": selected_name,
        "test_metrics": test_metrics,
        "test_group_ids": sorted(test_groups),
        "artifact": str(MODEL_PATH.relative_to(ROOT)),
    }
    METRICS_PATH.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(f"Selected by validation MAE: {selected_name}")
    print(f"Held-out chronological test metrics: {test_metrics}")
    print(f"Saved model: {MODEL_PATH}")
    return report


if __name__ == "__main__":
    main()
