"""Reproducible data-quality inspection script for TUMI-HEALT processed datasets.

Reads data/processed/*.csv without modifying any source or processed files and
prints an objective summary of rows, missing values, timestamps, units, and
quality statuses.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path


PROCESSED_FILES = {
    "blood": Path("data/processed/blood_processed.csv"),
    "sleep": Path("data/processed/sleep_processed.csv"),
    "cardiovascular": Path("data/processed/cardiovascular_processed.csv"),
}

MISSING_TOKENS = {"", "NA", "N/A", "NULL", "NONE", "NOT_AVAILABLE"}


def inspect_processed_csv(path: Path) -> dict[str, object]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    datasets = Counter(r.get("source_dataset", "") for r in rows)
    quality_statuses = Counter(r.get("quality_status", "") for r in rows)
    indicators = sorted({r.get("indicator", "") for r in rows if r.get("indicator")})
    subjects = sorted(
        {
            r.get("subject_id", "")
            for r in rows
            if r.get("subject_id") and r.get("subject_id") not in MISSING_TOKENS
        }
    )
    missing_values = sum(
        1 for r in rows if (r.get("value") or "").strip().upper() in MISSING_TOKENS
    )
    missing_timestamps = sum(
        1 for r in rows if (r.get("timestamp") or "").strip().upper() in MISSING_TOKENS
    )

    return {
        "file": str(path).replace("\\", "/"),
        "row_count": len(rows),
        "datasets": dict(datasets),
        "unique_indicators": len(indicators),
        "subject_count": len(subjects),
        "missing_value_rows": missing_values,
        "missing_timestamp_rows": missing_timestamps,
        "quality_statuses": dict(quality_statuses),
    }


def main() -> None:
    report = {
        category: inspect_processed_csv(path)
        for category, path in PROCESSED_FILES.items()
        if path.exists()
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
