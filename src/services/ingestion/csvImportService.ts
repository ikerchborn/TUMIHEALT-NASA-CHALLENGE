import type {
  CsvColumnMapping,
  CsvImportPreview,
  CsvImportResult,
  CsvInspectionResult,
  CsvValidatedRow,
  DataOrigin,
  HealthCategory,
  HealthRecordInput,
  ImportBatch,
  ValidationIssue,
} from '@/types';
import { recordAuditEvent } from '@/services/audit';
import { initializeDatabase } from '@/services/storage/db';
import { insertRecord } from '@/services/storage/recordStorage';
import { validateHealthRecordInput } from '@/services/validation';
import { validateCsvUploadConstraints } from '@/services/security';
import { parseCsv } from './csvParser';

const MISSING_MARKERS = new Set(['', 'NA', 'N/A', 'NULL', 'NONE', 'NOT_AVAILABLE']);

function generateBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseNullableNumber(
  rawValue: string | undefined,
  fieldName: string,
  errors: ValidationIssue[],
): number | null | undefined {
  if (rawValue === undefined) {
    return undefined;
  }
  const trimmed = rawValue.trim();
  if (MISSING_MARKERS.has(trimmed.toUpperCase())) {
    return null;
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    errors.push({
      field: fieldName,
      code: 'INVALID_CSV_NUMBER',
      message: `Value "${rawValue}" in column for "${fieldName}" is not a valid number.`,
    });
    return undefined;
  }
  return num;
}

function parseOptionalString(rawValue: string | undefined): string | undefined {
  if (rawValue === undefined) return undefined;
  const trimmed = rawValue.trim();
  if (MISSING_MARKERS.has(trimmed.toUpperCase())) {
    return undefined;
  }
  return trimmed;
}

function parseNullableString(rawValue: string | undefined): string | null | undefined {
  if (rawValue === undefined) return undefined;
  const trimmed = rawValue.trim();
  if (MISSING_MARKERS.has(trimmed.toUpperCase())) {
    return null;
  }
  return trimmed;
}

/**
 * Step 1 & 2 of CSV import: Inspects CSV headers, row count, and sample rows
 * without persisting anything to IndexedDB.
 */
export function inspectCsvFile(
  csvText: string,
  fileName: string,
  sampleSize = 5,
): CsvInspectionResult {
  const { headers, rows } = parseCsv(csvText);
  return {
    file_name: fileName,
    headers,
    total_rows: rows.length,
    sample_rows: rows.slice(0, sampleSize),
  };
}

/**
 * Steps 3-6 of CSV import: Maps source columns to TUMI-HEALT fields,
 * validates every row, and returns a preview for user confirmation.
 * Does NOT write health records to IndexedDB.
 */
export async function prepareCsvImportPreview(params: {
  csvText: string;
  fileName: string;
  profileId: string;
  category: HealthCategory;
  dataOrigin: DataOrigin;
  sourceDataset: string;
  mapping: CsvColumnMapping;
  actorId?: string;
}): Promise<CsvImportPreview> {
  const uploadCheck = validateCsvUploadConstraints(
    params.fileName,
    new TextEncoder().encode(params.csvText).byteLength,
  );
  if (!uploadCheck.valid) {
    throw new Error(uploadCheck.error);
  }
  const db = await initializeDatabase();
  const { headers, rows } = parseCsv(params.csvText);
  const batchId = generateBatchId();
  const now = new Date().toISOString();

  const missingMappingColumns: string[] = [];
  const requiredMappings: Array<keyof Pick<CsvColumnMapping, 'timestamp' | 'indicator' | 'value' | 'unit'>> =
    ['timestamp', 'indicator', 'value', 'unit'];

  for (const field of requiredMappings) {
    const colName = params.mapping[field];
    if (!colName || !headers.includes(colName)) {
      missingMappingColumns.push(`${field} -> "${colName ?? ''}"`);
    }
  }

  if (missingMappingColumns.length > 0) {
    const failedBatch: ImportBatch = {
      batch_id: batchId,
      profile_id: params.profileId,
      category: params.category,
      file_name: params.fileName,
      data_origin: params.dataOrigin,
      source_dataset: params.sourceDataset,
      status: 'failed',
      total_rows: rows.length,
      valid_rows: 0,
      invalid_rows: rows.length,
      imported_record_ids: [],
      created_at: now,
      updated_at: now,
    };
    await db.import_batches.add(failedBatch);
    await recordAuditEvent({
      profile_id: params.profileId,
      actor_id: params.actorId ?? params.profileId,
      action: 'IMPORT_FAILED',
      data_origin: params.dataOrigin,
      category: params.category,
      status: 'failure',
      details: {
        batch_id: batchId,
        file_name: params.fileName,
        reason: `Missing required mapped columns in CSV headers: ${missingMappingColumns.join(', ')}`,
      },
    });
    throw new Error(
      `CSV mapping error: missing required columns (${missingMappingColumns.join(', ')}).`,
    );
  }

  const validatedRows: CsvValidatedRow[] = [];
  const validRecords: HealthRecordInput[] = [];
  const invalidRows: CsvValidatedRow[] = [];

  for (let idx = 0; idx < rows.length; idx += 1) {
    const raw = rows[idx];
    const rowErrors: ValidationIssue[] = [];
    const m = params.mapping;

    const rawValue = raw[m.value];
    const parsedValue = parseNullableNumber(
      rawValue === undefined ? '' : rawValue,
      'value',
      rowErrors,
    );

    const astronautId =
      (m.astronaut_id ? parseOptionalString(raw[m.astronaut_id]) : undefined) ??
      params.profileId;

    const base = {
      astronaut_id: astronautId,
      timestamp: raw[m.timestamp] ?? '',
      indicator: raw[m.indicator] ?? '',
      value: parsedValue === undefined ? (Number.NaN as unknown as number) : parsedValue,
      unit: raw[m.unit] ?? '',
      data_origin: params.dataOrigin,
      ingestion_method: 'CSV_IMPORT' as const,
      import_batch_id: batchId,
      source_dataset: params.sourceDataset,
      quality_status:
        (m.quality_status ? parseOptionalString(raw[m.quality_status]) : undefined) ??
        (parsedValue === null ? 'missing_value' : 'verified'),
    };

    let candidate: HealthRecordInput;

    if (params.category === 'blood') {
      candidate = {
        ...base,
        category: 'blood',
        sample_id: m.sample_id ? parseOptionalString(raw[m.sample_id]) : undefined,
        specimen_type: m.specimen_type
          ? parseOptionalString(raw[m.specimen_type])
          : undefined,
        assay: m.assay ? parseOptionalString(raw[m.assay]) : undefined,
      };
    } else if (params.category === 'sleep') {
      candidate = {
        ...base,
        category: 'sleep',
        sleep_start: m.sleep_start ? parseNullableString(raw[m.sleep_start]) : undefined,
        sleep_end: m.sleep_end ? parseNullableString(raw[m.sleep_end]) : undefined,
        sleep_duration: m.sleep_duration
          ? parseNullableNumber(raw[m.sleep_duration], 'sleep_duration', rowErrors)
          : undefined,
        sleep_efficiency: m.sleep_efficiency
          ? parseNullableNumber(raw[m.sleep_efficiency], 'sleep_efficiency', rowErrors)
          : undefined,
        sleep_latency: m.sleep_latency
          ? parseNullableNumber(raw[m.sleep_latency], 'sleep_latency', rowErrors)
          : undefined,
      };
    } else {
      const systolic = m.systolic_blood_pressure
        ? parseNullableNumber(
            raw[m.systolic_blood_pressure],
            'systolic_blood_pressure',
            rowErrors,
          )
        : undefined;
      const diastolic = m.diastolic_blood_pressure
        ? parseNullableNumber(
            raw[m.diastolic_blood_pressure],
            'diastolic_blood_pressure',
            rowErrors,
          )
        : undefined;

      const bloodPressure =
        typeof systolic === 'number' && typeof diastolic === 'number'
          ? { systolic, diastolic }
          : undefined;

      candidate = {
        ...base,
        category: 'cardiovascular',
        heart_rate: m.heart_rate
          ? parseNullableNumber(raw[m.heart_rate], 'heart_rate', rowErrors)
          : undefined,
        blood_pressure: bloodPressure,
        cardiac_output: m.cardiac_output
          ? parseNullableNumber(raw[m.cardiac_output], 'cardiac_output', rowErrors)
          : undefined,
        activity_context: m.activity_context
          ? parseOptionalString(raw[m.activity_context])
          : undefined,
        sleep_state: m.sleep_state ? parseOptionalString(raw[m.sleep_state]) : undefined,
        device_id: m.device_id ? parseOptionalString(raw[m.device_id]) : undefined,
      };
    }

    const validation = validateHealthRecordInput(candidate);
    const combinedErrors = [...rowErrors, ...validation.errors];
    const isValid = combinedErrors.length === 0;

    const validatedRow: CsvValidatedRow = {
      row_number: idx + 1,
      raw,
      record_input: isValid ? candidate : null,
      valid: isValid,
      errors: combinedErrors,
      warnings: validation.warnings,
    };

    validatedRows.push(validatedRow);
    if (isValid) {
      validRecords.push(candidate);
    } else {
      invalidRows.push(validatedRow);
    }
  }

  const batch: ImportBatch = {
    batch_id: batchId,
    profile_id: params.profileId,
    category: params.category,
    file_name: params.fileName,
    data_origin: params.dataOrigin,
    source_dataset: params.sourceDataset,
    status: 'pending_confirmation',
    total_rows: rows.length,
    valid_rows: validRecords.length,
    invalid_rows: invalidRows.length,
    imported_record_ids: [],
    created_at: now,
    updated_at: now,
  };

  await db.import_batches.add(batch);
  await recordAuditEvent({
    profile_id: params.profileId,
    actor_id: params.actorId ?? params.profileId,
    action: 'IMPORT_VALIDATED',
    data_origin: params.dataOrigin,
    category: params.category,
    status: invalidRows.length === 0 ? 'success' : 'warning',
    details: {
      batch_id: batchId,
      file_name: params.fileName,
      total_rows: rows.length,
      valid_rows: validRecords.length,
      invalid_rows: invalidRows.length,
    },
  });

  return {
    batch,
    headers,
    mapping: params.mapping,
    rows: validatedRows,
    valid_records: validRecords,
    invalid_rows: invalidRows,
  };
}

/**
 * Steps 7-9 (Confirm): Persists validated records from an approved preview
 * into IndexedDB and generates audit events.
 */
export async function confirmCsvImport(
  preview: CsvImportPreview,
  actorId?: string,
): Promise<CsvImportResult> {
  const db = await initializeDatabase();
  const existingBatch = await db.import_batches.get(preview.batch.batch_id);
  if (existingBatch && existingBatch.status !== 'pending_confirmation') {
    throw new Error(
      `Import batch "${preview.batch.batch_id}" has already been finalized with status "${existingBatch.status}".`,
    );
  }

  const importedIds: string[] = [];
  const actor = actorId ?? preview.batch.profile_id;

  for (const input of preview.valid_records) {
    const saved = await insertRecord(input);
    importedIds.push(saved.id);
    await recordAuditEvent({
      record_id: saved.id,
      profile_id: saved.astronaut_id,
      actor_id: actor,
      action: 'RECORD_CREATED',
      data_origin: saved.data_origin,
      category: saved.category,
      status: 'success',
      details: {
        ingestion_method: 'CSV_IMPORT',
        import_batch_id: preview.batch.batch_id,
        indicator: saved.indicator,
        value: saved.value,
        unit: saved.unit,
      },
    });
  }

  const finalStatus =
    preview.invalid_rows.length > 0 ? 'partially_confirmed' : 'confirmed';

  const updatedBatch: ImportBatch = {
    ...preview.batch,
    status: finalStatus,
    imported_record_ids: importedIds,
    updated_at: new Date().toISOString(),
  };

  await db.import_batches.put(updatedBatch);
  await recordAuditEvent({
    profile_id: preview.batch.profile_id,
    actor_id: actor,
    action: 'IMPORT_CONFIRMED',
    data_origin: preview.batch.data_origin,
    category: preview.batch.category,
    status: preview.invalid_rows.length > 0 ? 'warning' : 'success',
    details: {
      batch_id: updatedBatch.batch_id,
      file_name: updatedBatch.file_name,
      imported_count: importedIds.length,
      skipped_invalid_count: preview.invalid_rows.length,
    },
  });

  return {
    batch: updatedBatch,
    imported_count: importedIds.length,
    skipped_invalid_count: preview.invalid_rows.length,
    imported_record_ids: importedIds,
  };
}

/**
 * Steps 7-9 (Cancel): Cancels a pending CSV import without writing any health records.
 */
export async function cancelCsvImport(
  preview: CsvImportPreview,
  actorId?: string,
): Promise<ImportBatch> {
  const db = await initializeDatabase();
  const updatedBatch: ImportBatch = {
    ...preview.batch,
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  };

  await db.import_batches.put(updatedBatch);
  await recordAuditEvent({
    profile_id: preview.batch.profile_id,
    actor_id: actorId ?? preview.batch.profile_id,
    action: 'IMPORT_CANCELLED',
    data_origin: preview.batch.data_origin,
    category: preview.batch.category,
    status: 'success',
    details: {
      batch_id: updatedBatch.batch_id,
      file_name: updatedBatch.file_name,
      total_rows: updatedBatch.total_rows,
    },
  });

  return updatedBatch;
}

export async function listImportBatches(profileId?: string): Promise<ImportBatch[]> {
  const db = await initializeDatabase();
  if (profileId) {
    return db.import_batches
      .where('profile_id')
      .equals(profileId)
      .reverse()
      .sortBy('created_at');
  }
  return db.import_batches.orderBy('created_at').reverse().toArray();
}
