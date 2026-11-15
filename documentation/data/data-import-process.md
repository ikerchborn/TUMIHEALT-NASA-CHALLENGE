# CSV Data Import Process

## Supported Format

Currently, file-based ingestion supports **CSV** files only (`.csv`, RFC-4180 compatible). Excel (`.xlsx`/`.xls`) and JSON imports are not implemented in the browser ingestion service.

## Mandatory 9-Step Workflow

1. **Select CSV File:** The user selects a local `.csv` file in the browser.
2. **Inspect Structure:** `inspectCsvFile(csvText, fileName)` parses headers, counts total rows, and returns sample rows without writing to IndexedDB.
3. **Map Columns:** The user maps source CSV headers to TUMI-HEALT variables using `CsvColumnMapping` (`timestamp`, `indicator`, `value`, `unit`, plus optional category-specific fields).
4. **Validate Mapping & Rows:** `prepareCsvImportPreview(...)` verifies required mappings exist, parses numeric values (treating `""`, `NA`, `N/A`, `NULL`, `NONE`, `NOT_AVAILABLE` as explicit `null` while preserving `"0"` as `0`), and runs `validateHealthRecordInput` on every row.
5. **Display Preview:** The UI receives `CsvImportPreview` containing `valid_records`, `invalid_rows`, and the pending `ImportBatch`.
6. **Identify Invalid Rows:** Invalid rows include row numbers and specific `ValidationIssue` errors/warnings.
7. **User Confirmation or Cancellation:** The application **never** imports records automatically. The user must explicitly choose:
   - **Confirm** (`confirmCsvImport`) to persist valid records.
   - **Cancel** (`cancelCsvImport`) to abort without writing any health records.
8. **Persist Valid Records:** On confirmation, valid records are stored in IndexedDB with `ingestion_method: "CSV_IMPORT"` and linked via `import_batch_id`.
9. **Summary & Audit Events:** Returns `CsvImportResult` with counts and records `IMPORT_CONFIRMED` (or `IMPORT_CANCELLED`) plus `RECORD_CREATED` audit events.
