# Data Validation Rules

## Scope

Validation (`src/services/validation/recordValidator.ts`) enforces **technical correctness, unit consistency, and data provenance**. It does **not** implement clinical thresholds, reference ranges, or medical diagnoses.

## General Field Rules

- `astronaut_id`: Required non-empty string.
- `timestamp`: Required valid ISO 8601 date or date-time string (`YYYY-MM-DD...`).
- `indicator`: Required non-empty string.
- `value`: Must be a finite `number` or explicit `null` (never `undefined` or `NaN`). Numeric `0` is valid and distinct from `null`.
- `unit`: Required non-empty string.
- `data_origin`: Must be `SPACEFLIGHT`, `GROUND_ANALOG`, or `SYNTHETIC`.
- `source_dataset`: Must be a non-empty string when provided.

## Unit Consistency Rules

- Known indicators in `INDICATOR_UNIT_REGISTRY` (`src/services/validation/unitRegistry.ts`) accept only their registered units (e.g., `heart_rate` -> `bpm`, `sleep_efficiency` -> `%`, `cardiac_output` -> `L/min`).
- Incompatible units are **rejected** with `INCOMPATIBLE_UNIT` and are **never silently converted**.
- Known source-dataset unit discrepancies (such as `OSD-569` `hemoglobin` labeled with `%` and `unit_label_requires_verification`) are **rejected** with `AMBIGUOUS_SOURCE_UNIT` until verified, without converting `%` to `g/dL`.
- `validateUnitConsistency(records)` ensures analytics never mix incompatible units for the same indicator.

## Category-Specific Rules

- **Blood:** Optional `sample_id`, `specimen_type`, and `assay` must be non-empty strings if provided.
- **Sleep:** Optional `sleep_start` and `sleep_end` must be valid ISO timestamps (`sleep_end >= sleep_start`). `sleep_duration` and `sleep_latency` must be `>= 0`. `sleep_efficiency` must be within `0` to `100` (percentage bounds).
- **Cardiovascular:** Optional `heart_rate` and `cardiac_output` must be `>= 0`. Optional `blood_pressure` must contain non-negative finite `systolic` and `diastolic` numbers.
