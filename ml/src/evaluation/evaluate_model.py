import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

from src.features.thermal_features import FEATURE_COLUMNS, TARGET_COLUMN
from src.training.train_model import METRICS_PATH, MODEL_PATH, load_dataset


def main() -> dict:
    if not MODEL_PATH.exists() or not METRICS_PATH.exists():
        raise FileNotFoundError("Train a model first: python -m src.training.train_model")
    frame = load_dataset().dropna(subset=[*FEATURE_COLUMNS, TARGET_COLUMN])
    report = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    test_groups = set(report.get("test_group_ids", []))
    if not test_groups:
        raise ValueError("Metrics file does not list held-out test groups. Re-run model training.")
    test = frame[frame.group_id.isin(test_groups)]
    artifact = joblib.load(MODEL_PATH)
    prediction = artifact["model"].predict(test[FEATURE_COLUMNS])
    actual = test[TARGET_COLUMN]
    result = {
        "model": artifact["model_name"],
        "test_samples": len(test),
        "mae_c": float(mean_absolute_error(actual, prediction)),
        "rmse_c": float(np.sqrt(mean_squared_error(actual, prediction))),
        "r2": float(r2_score(actual, prediction)),
    }
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    main()
