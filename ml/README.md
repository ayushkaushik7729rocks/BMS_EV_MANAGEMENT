# Thermal ML

This pipeline trains a +10-minute battery temperature regressor from CALCE CX2_4 source traces. It never trains on generated backend mock telemetry.

## Run it

Activate the backend virtual environment first, then from the repository root:

```powershell
cd ml
python -m src.preprocessing.download_calce
python -m src.preprocessing.prepare_data
python -m src.training.train_model
python -m src.evaluation.evaluate_model
```

The official source archive is `https://web.calce.umd.edu/batteries/data/CX2_4.zip`. The importer uses `CX2_4/source data/*.txt` columns `Time`, `mV`, `mA`, `Temperature`, and `Pgm cycle`. It does not use the separate thermocouple logger files until an unambiguous time alignment is established. Raw and processed data are ignored by Git. The selected model is saved to `ml/models/thermal_predictor.joblib`; measured metrics and exact chronological split metadata go to `ml/models/metrics.json`.

See `../docs/ML_PIPELINE.md` for feature definitions, horizon selection, split method, candidate models, evaluation, and limitations.
