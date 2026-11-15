# Data Ingestion Architecture

## Overview

TUMI-HEALT's application UI accepts personal measurements through file import. The service layer retains measurement persistence functions for internal callers such as demo seeding. Validated records are stored in the user's browser via IndexedDB:

1. **CSV Import** (`ingestion_method: "CSV_IMPORT"`): RFC-4180 parsing, header inspection, column mapping, row-level validation, preview, and explicit confirmation or cancellation.
2. **XML Import**: Browser `DOMParser` parses the documented `TUMIMeasurements` schema. DTD/entity declarations are rejected, and records are normalized into the same validated import pipeline.
3. **Excel Import** (`.xlsx`; legacy `.xls` remains accepted): Workbook sheets are extracted and normalized to CSV. Personal imports reject merged cells, formulas without stored values, and workbooks without readable data. The NASA Research ETL continues using the adapter's default, non-strict mode.

All personal measurement files are limited to 5 MiB. Import batches retain the original file name and format. The user may explicitly import valid rows while skipping invalid rows; rejected rows can be downloaded with source values and validation errors.

## Complete Data Lifecycle

```text
CSV / XML / Excel Import
  -> Validation (types, timestamps, units, provenance, category rules)
  -> Preview (valid vs. invalid rows, including source row/XML line)
  -> User Confirmation (import valid rows, skip invalid rows, or cancel)
  -> IndexedDB (Dexie.js local stores)
  -> Analytics Engine (summaries, comparisons, trend points)
  -> Dashboard UI (visualization & user review)
  -> Audit Trail (local IndexedDB `audit_events` store)
```

## Separation of Provenance and Ingestion Method

- **`data_origin`** identifies the scientific origin of the data (`SPACEFLIGHT`, `GROUND_ANALOG`, or `SYNTHETIC`).
- **`ingestion_method`** identifies how the record entered the local browser database (`MANUAL` for internal single-record service callers or `CSV_IMPORT` for imported files).

These two fields are never conflated. For example, a ground-based bed-rest dataset imported from CSV retains `data_origin: "GROUND_ANALOG"` and `ingestion_method: "CSV_IMPORT"`.

## Service Entry Points

- Internal measurement persistence: `saveBloodMeasurement`, `saveSleepMeasurement`, `saveCardiovascularMeasurement` in `src/services/healthService.ts`; these functions are not exposed as manual-entry forms in the application UI.
- CSV ingestion: `inspectCsvFile`, `prepareCsvImportPreview`, `confirmCsvImport`, `cancelCsvImport` in `src/services/ingestion/csvImportService.ts`
- XML parsing and safety checks: `parseMeasurementXml` in `src/services/ingestion/xmlMeasurementAdapter.ts`
- Generated import templates: `generateImportTemplate` in `src/services/ingestion/importTemplateService.ts`
