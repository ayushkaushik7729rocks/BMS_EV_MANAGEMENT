from pathlib import Path

import joblib
import pandas as pd

from src.features.thermal_features import FEATURE_COLUMNS, latest_feature_row


class ThermalPredictor:
    def __init__(self, model_path: Path):
        self.model_path = Path(model_path)
        self.artifact = joblib.load(self.model_path) if self.model_path.exists() else None

    @property
    def model_name(self) -> str:
        return str(self.artifact.get("model_name", "trained_model")) if self.artifact else "unavailable"

    def predict_from_rows(self, rows) -> float | None:
        # The API may start before model training finishes; pick up the artifact
        # on a later request without reloading an already cached model.
        if self.artifact is None and self.model_path.exists():
            self.artifact = joblib.load(self.model_path)
        if self.artifact is None:
            return None
        history = [
            {
                "timestamp": row.timestamp,
                "cell_1_temperature": row.cell_1_temperature,
                "cell_2_temperature": row.cell_2_temperature,
                "cell_3_temperature": row.cell_3_temperature,
                "cell_4_temperature": row.cell_4_temperature,
                "voltage_v": row.voltage,
                "current_a": row.current,
                "power_w": row.power,
            }
            for row in rows
        ]
        features = latest_feature_row(history, self.artifact.get("horizon_minutes", 10.0))
        if features is None:
            return None
        columns = self.artifact.get("feature_columns", FEATURE_COLUMNS)
        features = pd.DataFrame(features, columns=columns)
        prediction = self.artifact["model"].predict(features)
        return float(prediction[0])
