# Scientific Data Processing & Quality Report

## Inspected Processed Datasets (`data/processed/`)

Verified via `scripts/generate_data_quality_report.py`:

| Category | File | Rows | Datasets | Subjects | Missing Values | Missing ISO Timestamps |
| --- | --- | --- | --- | --- | --- | --- |
| Blood | `data/processed/blood_processed.csv` | 1,092 | `OSD-575` (532), `OSD-569` (560) | 4 | 30 | 1,092 (relative timepoints `L-3`, `R+1`, etc.) |
| Sleep | `data/processed/sleep_processed.csv` | 1,194 | `UTMB_Campaign_1_BRSMACT` (1,194) | 3 | 58 | 0 |
| Cardiovascular | `data/processed/cardiovascular_processed.csv` | 150 | `Apollo_AP005` (150) | 0 (grouped summaries) | 1 | 150 |

## Key Engineering Rules Enforced (`src/services/dataEngineering/scientificImportMapper.ts`)
1. **Origin Classification:** `UTMB_Campaign_1_BRSMACT` is classified as `GROUND_ANALOG`; `OSD-569`, `OSD-575`, and `Apollo_AP005` are classified as `SPACEFLIGHT`.
2. **Aggregate Exclusion:** `Apollo_AP005` rows carry `quality_status: "aggregated_not_individual"` and are excluded from individual astronaut baselines.
3. **No Invented Timestamps or Zeroes:** Missing values (`NOT_AVAILABLE`, `NA`, `""`) remain `null`; rows without valid ISO timestamps are not fabricated.
4. **Cohort Isolation:** Records from distinct `subject_id` values are never merged into a single astronaut profile.
