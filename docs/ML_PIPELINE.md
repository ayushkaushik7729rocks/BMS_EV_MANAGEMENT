# Thermal ML pipeline

## Dataset

The reproducible source is the official CALCE CX2_4 archive: <https://web.calce.umd.edu/batteries/data/CX2_4.zip>. `download_calce.py` retrieves it into ignored `ml/data/raw/CX2_4.zip`; `prepare_data.py` verifies and extracts it under `ml/data/raw/extracted/`.

The current training input is the 120 `CX2_4/source data/*.txt` cycling traces from the downloaded archive. The importer uses the CALCE columns `Time` (elapsed seconds), `mV`, `mA`, `Temperature`, and `Pgm cycle`; it converts voltage/current to SI units and computes power as V x A. The separate `CX2_4/Temperature/*.csv` logger files are preserved in the extracted archive but are not used in the current fit because the cycling traces already contain a per-sample temperature column and no verified timestamp join has been established between those logger files and every test trace.

Mock telemetry is never included in the CALCE training or evaluation table.

## Target and features

The supervised target is recorded battery temperature at the nearest sample to +600 elapsed seconds (+10 minutes). `build_supervised_rows` derives the future index from each trace's actual time column, not a fixed row count; targets crossing a `Pgm cycle` group or outside the sampling tolerance are omitted. At least 300 seconds of preceding history is required.

Features: current temperature, rolling 60-second mean and standard deviation, 60-second temperature delta and slope, 300-second lag temperature, voltage, current, power, and 60-second current delta. Each feature uses only current and earlier samples. Training and inference call the same feature implementation.

## Time-aware split and selection

Whole source-file/cycle groups are sorted chronologically by the CALCE filename date, then assigned 70% train, 15% validation, and the latest 15% test. The test groups are not shuffled into training. Candidate estimators are linear regression, random forest, and XGBoost. Validation MAE selects the model; the selected estimator is refit on train plus validation and scored once on the held-out test partition. MAE, RMSE, and R-squared are computed from actual CALCE test rows and saved in `ml/models/metrics.json`.

The exact group counts, sample counts, date ranges, validation metrics, test metrics, and selected model are recorded in `metrics.json` after training. No metric is claimed until that command has completed.

## Inference and limits

The API loads `ml/models/thermal_predictor.joblib` once and predicts from the newest shared-feature row. If no trained artifact is present, the API can provide an explicitly labeled recent-slope `trend_baseline`; this is not an ML model and must not be treated as a validated safety prediction. The training package uses single-cell CALCE CX2_4 data, so its errors do not establish pack-level performance for a 1S4P prototype.
