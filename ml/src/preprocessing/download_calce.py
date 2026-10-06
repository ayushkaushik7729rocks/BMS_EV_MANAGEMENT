from pathlib import Path
from urllib.request import urlopen

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "ml" / "data" / "raw"
URL = "https://web.calce.umd.edu/batteries/data/CX2_4.zip"
DESTINATION = DATA_DIR / "CX2_4.zip"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if DESTINATION.exists() and DESTINATION.stat().st_size > 0:
        print(f"Using existing archive: {DESTINATION}")
        return
    print(f"Downloading official CALCE CX2_4 archive from {URL}")
    with urlopen(URL, timeout=90) as response, DESTINATION.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    print(f"Saved {DESTINATION} ({DESTINATION.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
