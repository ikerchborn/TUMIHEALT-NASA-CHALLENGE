# Data Ingestion Architecture

## Overview

TUMI-HEALT supports two local data ingestion mechanisms, both of which store validated records exclusively in the user's browser via IndexedDB:

1. **Manual Data Entry** (`ingestion_method: "MANUAL"`): Structured single-record entry for blood biomarkers, sleep monitoring, and cardiovascular monitoring.
2. **CSV File Import** (`ingestion_method: "CSV_IMPORT"`): Multi-step file ingestion with header inspection, column mapping, row-level validation, user preview, and explicit confirmation or cancellation.

## Complete Data Lifecycle

```text
Manual Entry / CSV Import
  -> Validation (types, timestamps, units, provenance, category rules)
  -> Preview (CSV import only: valid vs. invalid rows)
  -> User Confirmation (confirm or cancel)
  -> IndexedDB (Dexie.js local stores)
  -> Analytics Engine (summaries, comparisons, trend points)
  -> Dashboard UI (visualization & user review)
  -> Audit Trail (local IndexedDB `audit_events` store)
```

## Separation of Provenance and Ingestion Method

- **`data_origin`** identifies the scientific origin of the data (`SPACEFLIGHT`, `GROUND_ANALOG`, or `SYNTHETIC`).
- **`ingestion_method`** identifies how the record entered the local browser database (`MANUAL` or `CSV_IMPORT`).

These two fields are never conflated. For example, a ground-based bed-rest dataset imported from CSV retains `data_origin: "GROUND_ANALOG"` and `ingestion_method: "CSV_IMPORT"`.

## Service Entry Points

- Manual entry: `saveBloodMeasurement`, `saveSleepMeasurement`, `saveCardiovascularMeasurement` in `src/services/healthService.ts`
- CSV ingestion: `inspectCsvFile`, `prepareCsvImportPreview`, `confirmCsvImport`, `cancelCsvImport` in `src/services/ingestion/csvImportService.ts`
