# Personal Measurement Import Process

## Supported Formats and XML Schema

Personal imports accept `.csv`, `.xml`, and `.xlsx` files up to 5 MiB. Legacy `.xls` workbooks remain supported for compatibility. The Import page can generate CSV, XML, and XLSX templates from the indicator catalog and unit registry. Unsupported extensions, empty files, and oversized files are rejected before parsing.

CSV files use comma delimiters and RFC-4180 quoting. Dates must be valid ISO-8601 values and may not be in the future.

XML uses this schema (one measurement per record):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<TUMIMeasurements>
  <Measurement>
    <timestamp>2026-01-15T08:00:00Z</timestamp>
    <indicator>glucose</indicator>
    <value>95</value>
    <unit>mg/dL</unit>
  </Measurement>
</TUMIMeasurements>
```

The four elements shown are required. Optional category-specific fields may be supplied. The browser `DOMParser` is used; `DOCTYPE` and entity declarations are rejected. Malformed XML and invalid roots produce specific errors. Missing required elements are reported against the measurement's row and source line.

Personal XLSX imports require readable flat worksheets. Merged cells and formulas without a stored result are rejected with a sheet/cell location. This strict check is opt-in and does not change NASA Research workbook processing.

## Mandatory 9-Step Workflow

1. **Select a File:** The user selects a supported local measurement file. The importer validates its extension and size before reading it.
2. **Normalize and Inspect:** CSV is parsed directly, XML is safely normalized, and personal Excel sheets are extracted in strict mode. `inspectCsvFile(csvText, fileName)` returns headers, row count, and sample rows without writing health records.
3. **Map Columns:** The user maps source headers to `timestamp`, `indicator`, `value`, and `unit`, plus optional category-specific fields.
4. **Validate Mapping & Rows:** `prepareCsvImportPreview(...)` validates required mappings, numeric values (treating `""`, `NA`, `N/A`, `NULL`, `NONE`, `NOT_AVAILABLE` as explicit `null` while preserving `"0"` as `0`), supported indicators, compatible units, and dates.
5. **Display Preview:** The UI receives `CsvImportPreview` containing `valid_records`, `invalid_rows`, and the pending `ImportBatch`.
6. **Identify Invalid Rows:** Invalid rows include their source row number, field, error code, explanation, and applicable XML line or missing-element details. A CSV rejection report includes the error and original row values.
7. **User Confirmation or Cancellation:** The application **never** imports records automatically. If invalid rows exist, the interface explains that only valid rows will be persisted and the user explicitly chooses:
   - **Import valid rows and skip invalid** (`confirmCsvImport`) to persist only valid records.
   - **Cancel** (`cancelCsvImport`) to abort without writing any health records.
8. **Persist Valid Records:** On confirmation, valid records are stored in IndexedDB with `ingestion_method: "CSV_IMPORT"` and linked via `import_batch_id`.
9. **Summary & Audit Events:** Returns `CsvImportResult` with counts and records `IMPORT_CONFIRMED` (or `IMPORT_CANCELLED`) plus `RECORD_CREATED` audit events. Each batch retains the original file name and format for provenance.

## Personal Trends

The Trends workspace reads only health records scoped to the active local profile, not `research_records` or cohort aggregates. It provides four indicator charts with 7D, 14D, 30D, 90D, and MAX ranges. A personal median baseline is shown only when the existing baseline engine finds at least three valid compatible measurements. Daily check-ins with symptoms are marked and listed separately; the timeline note states: “Events are shown together, not as cause and effect.”
