from __future__ import annotations

import re
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd

from src.features.thermal_features import FEATURE_COLUMNS, TARGET_COLUMN, build_supervised_rows

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = PROJECT_ROOT / "ml" / "data" / "raw" / "CX2_4.zip"
EXTRACT_DIR = PROJECT_ROOT / "ml" / "data" / "raw" / "extracted"
OUTPUT = PROJECT_ROOT / "ml" / "data" / "processed" / "cx2_4_thermal_features.csv"


def _run_date(name: str) -> str:
    # Run dates follow the cell ID. Some archive names append notes like
    # "part1" or "chamber acting weird" after the date.
    match = re.search(r"CX2_4_(\d{1,2})_(\d{1,2})_(\d{2})(?!\d)", name, flags=re.IGNORECASE)
    if not match:
        return "1900-01-01"
    month, day, year = map(int, match.groups())
    try:
        return date(2000 + year, month, day).isoformat()
    except ValueError:
        return "1900-01-01"


def extract_archive(archive: Path = ARCHIVE, destination: Path = EXTRACT_DIR) -> Path:
    if not archive.exists():
        raise FileNotFoundError(f"CALCE archive not found: {archive}. Run python -m src.preprocessing.download_calce first.")
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        bad_member = zipped.testzip()
        if bad_member:
            raise ValueError(f"CALCE ZIP failed integrity check at {bad_member}")
        zipped.extractall(destination)
    return destination / "CX2_4" / "source data"


def read_cycling_file(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, sep="\t", encoding="latin1", engine="python", on_bad_lines="skip")
    frame.columns = [str(column).strip() for column in frame.columns]
    aliases = {column.lower(): column for column in frame.columns}
    required_aliases = {"time": "time_seconds", "mv": "voltage_v", "ma": "current_a", "temperature": "temperature_c"}
    missing = [name for name in required_aliases if name not in aliases]
    if missing:
        raise ValueError(f"{path.name} is missing CALCE columns: {missing}")
    output = pd.DataFrame({
        "time_seconds": pd.to_numeric(frame[aliases["time"]], errors="coerce"),
        "voltage_v": pd.to_numeric(frame[aliases["mv"]], errors="coerce") / 1000.0,
        "current_a": pd.to_numeric(frame[aliases["ma"]], errors="coerce") / 1000.0,
        "temperature_c": pd.to_numeric(frame[aliases["temperature"]], errors="coerce"),
    })
    output["power_w"] = output["voltage_v"] * output["current_a"]
    cycle_col = aliases.get("pgm cycle")
    output["cycle_id"] = frame[cycle_col].astype(str).fillna("unknown") if cycle_col else "single"
    output = output.dropna(subset=["time_seconds", "voltage_v", "current_a", "temperature_c"])
    output = output[(output["voltage_v"] > 0) & output["temperature_c"].between(-30, 120)]
    return output.reset_index(drop=True)


def prepare_dataset() -> pd.DataFrame:
    source_dir = extract_archive()
    traces = sorted(source_dir.glob("*.txt"))
    if not traces:
        raise FileNotFoundError(f"No CALCE CX2_4 cycling .txt files found under {source_dir}")
    prepared: list[pd.DataFrame] = []
    for path in traces:
        frame = read_cycling_file(path)
        if frame.empty:
            continue
        frame["source_file"] = path.name
        frame["run_date"] = _run_date(path.name)
        for cycle_id, cycle in frame.groupby("cycle_id", sort=True, dropna=False):
            rows = build_supervised_rows(cycle, horizon_minutes=10.0)
            if rows.empty:
                continue
            rows["source_file"] = path.name
            rows["run_date"] = _run_date(path.name)
            rows["cycle_id"] = str(cycle_id)
            rows["group_id"] = f"{path.name}::cycle-{cycle_id}"
            prepared.append(rows)
    if not prepared:
        raise ValueError("The official files were read, but no trace has enough continuous history and +10-minute labels.")
    result = pd.concat(prepared, ignore_index=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUTPUT, index=False)
    print(f"Prepared {len(result):,} rows from {len(traces)} CALCE files: {OUTPUT}")
    print(f"Features: {', '.join(FEATURE_COLUMNS)}")
    print(f"Target: {TARGET_COLUMN} at approximately +10 minutes")
    return result


if __name__ == "__main__":
    prepare_dataset()
