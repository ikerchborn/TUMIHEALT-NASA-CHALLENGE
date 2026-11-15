import type {
  AuditEvent,
  DataOrigin,
  HealthRecord,
  HealthRecordInput,
  ImportBatch,
  LocalAstronautProfile,
  LocalBackupPayload,
  MissionContext,
  DailyCheckIn,
  MedicalReviewRequest,
} from '@/types';
import { recordAuditEvent } from '@/services/audit';
import { initializeDatabase } from '@/services/storage/db';
import { validateHealthRecordInput } from '@/services/validation';

export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB safety limit
export const MAX_MEASUREMENT_FILE_BYTES = MAX_CSV_FILE_BYTES;

export function validateMeasurementFileConstraints(
  fileName: string,
  byteLength: number,
): { valid: boolean; format?: 'csv' | 'xml' | 'xlsx' | 'xls'; error?: string } {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension !== 'csv' && extension !== 'xml' && extension !== 'xlsx' && extension !== 'xls') {
    return {
      valid: false,
      error: 'This file type is not supported. Upload a CSV (.csv), XML (.xml), or Excel workbook (.xlsx).',
    };
  }
  if (byteLength <= 0) {
    return { valid: false, error: 'The selected file is empty. Choose a non-empty CSV, XML, or XLSX file.' };
  }
  if (byteLength > MAX_MEASUREMENT_FILE_BYTES) {
    return {
      valid: false,
      error: `The file exceeds the 5 MiB limit (${MAX_MEASUREMENT_FILE_BYTES} bytes). Upload a smaller CSV, XML, or XLSX file.`,
    };
  }
  return { valid: true, format: extension };
}

/**
 * Validates CSV file size and extension before parsing.
 */
export function validateCsvUploadConstraints(
  fileName: string,
  byteLength: number,
): { valid: boolean; error?: string } {
  if (!fileName.toLowerCase().endsWith('.csv')) {
    return { valid: false, error: 'Only .csv files are supported.' };
  }
  if (byteLength <= 0) {
    return { valid: false, error: 'CSV file is empty.' };
  }
  if (byteLength > MAX_CSV_FILE_BYTES) {
    return {
      valid: false,
      error: `CSV file exceeds maximum allowed size of ${MAX_CSV_FILE_BYTES} bytes.`,
    };
  }
  return { valid: true };
}

export function decodeUtf8Text(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      'The file contains invalid UTF-8 text. Save it as UTF-8 CSV or XML, or upload an XLSX workbook.',
    );
  }
}

/**
 * Computes a SHA-256 hex digest using the Web Crypto API when available,
 * falling back to a deterministic FNV-1a hex string in constrained contexts.
 */
export async function computeSha256Hex(content: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Protects CSV exports against spreadsheet formula injection (CWE-1236) by
 * prefixing cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with `'`.
 */
export function sanitizeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

export function exportRecordsToSafeCsv(records: readonly HealthRecord[]): string {
  const headers = [
    'id',
    'astronaut_id',
    'category',
    'timestamp',
    'indicator',
    'value',
    'unit',
    'data_origin',
    'ingestion_method',
    'source_dataset',
    'quality_status',
  ];
  const lines = [headers.join(',')];
  for (const r of records) {
    lines.push(
      [
        r.id,
        r.astronaut_id,
        r.category,
        r.timestamp,
        r.indicator,
        r.value === null ? 'NOT_AVAILABLE' : r.value,
        r.unit,
        r.data_origin,
        r.ingestion_method,
        r.source_dataset,
        r.quality_status,
      ]
        .map(sanitizeCsvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

/**
 * Exports a local JSON backup (scoped to a single astronaut or all local data)
 * with a SHA-256 integrity checksum and records an audit event without logging
 * sensitive measurement values.
 */
export async function exportLocalBackup(
  astronautId?: string,
): Promise<LocalBackupPayload> {
  const db = await initializeDatabase();

  const profiles = astronautId
    ? await db.profiles.where('astronaut_id').equals(astronautId).toArray()
    : await db.profiles.toArray();
  const bloodRecords = astronautId
    ? await db.blood_records.where('astronaut_id').equals(astronautId).toArray()
    : await db.blood_records.toArray();
  const sleepRecords = astronautId
    ? await db.sleep_records.where('astronaut_id').equals(astronautId).toArray()
    : await db.sleep_records.toArray();
  const cardioRecords = astronautId
    ? await db.cardiovascular_records
        .where('astronaut_id')
        .equals(astronautId)
        .toArray()
    : await db.cardiovascular_records.toArray();
  const missionContexts = astronautId
    ? await db.mission_contexts.where('astronaut_id').equals(astronautId).toArray()
    : await db.mission_contexts.toArray();
  const importBatches = astronautId
    ? await db.import_batches.where('profile_id').equals(astronautId).toArray()
    : await db.import_batches.toArray();
  const auditEvents = astronautId
    ? await db.audit_events.where('profile_id').equals(astronautId).toArray()
    : await db.audit_events.toArray();
  const dailyCheckIns = astronautId
    ? await db.daily_checkins.where('profile_id').equals(astronautId).toArray()
    : await db.daily_checkins.toArray();
  const medicalReviewRequests = astronautId
    ? await db.medical_review_requests.where('profile_id').equals(astronautId).toArray()
    : await db.medical_review_requests.toArray();

  const origins = Array.from(
    new Set<DataOrigin>([
      ...bloodRecords.map((r) => r.data_origin),
      ...sleepRecords.map((r) => r.data_origin),
      ...cardioRecords.map((r) => r.data_origin),
    ]),
  );

  const body = {
    schema_version: 4,
    exported_at: new Date().toISOString(),
    astronaut_id: astronautId ?? ('ALL' as const),
    data_origins_present: origins,
    profiles,
    blood_records: bloodRecords,
    sleep_records: sleepRecords,
    cardiovascular_records: cardioRecords,
    mission_contexts: missionContexts,
    import_batches: importBatches,
    audit_events: auditEvents,
    daily_checkins: dailyCheckIns,
    medical_review_requests: medicalReviewRequests,
  };

  const checksum = await computeSha256Hex(JSON.stringify(body));

  await recordAuditEvent({
    profile_id: astronautId ?? 'SYSTEM_ALL',
    actor_id: astronautId ?? 'SYSTEM',
    action: 'PROFILE_UPDATED',
    status: 'success',
    details: {
      operation: 'LOCAL_BACKUP_EXPORTED',
      record_count:
        bloodRecords.length + sleepRecords.length + cardioRecords.length,
    },
  });

  return {
    ...body,
    checksum_sha256: checksum,
  };
}

const SUPPORTED_BACKUP_VERSIONS = new Set([1, 2, 3, 4]);

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateBackupPayloadStructure(payload: LocalBackupPayload): void {
  if (!isRecordObject(payload)) {
    throw new Error('Invalid backup payload: expected an object.');
  }
  if (!SUPPORTED_BACKUP_VERSIONS.has(payload.schema_version)) {
    throw new Error(
      `Unsupported backup schema_version "${String(payload.schema_version)}". Supported versions: 1, 2, 3, 4.`,
    );
  }

  const requiredArrays: Array<keyof LocalBackupPayload> = [
    'profiles',
    'blood_records',
    'sleep_records',
    'cardiovascular_records',
    'mission_contexts',
    'import_batches',
    'audit_events',
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(payload[key])) {
      throw new Error(`Invalid backup payload: "${key}" must be an array.`);
    }
  }
  if (
    payload.schema_version >= 4 &&
    (!Array.isArray(payload.daily_checkins) ||
      !Array.isArray(payload.medical_review_requests))
  ) {
    throw new Error(
      'Invalid backup payload: schema version 4 requires daily_checkins and medical_review_requests arrays.',
    );
  }
  const dailyCheckIns = payload.daily_checkins ?? [];
  const medicalReviewRequests = payload.medical_review_requests ?? [];

  for (const profile of payload.profiles) {
    if (
      !isRecordObject(profile) ||
      typeof profile.astronaut_id !== 'string' ||
      !profile.astronaut_id.trim() ||
      typeof profile.display_name !== 'string' ||
      !profile.display_name.trim()
    ) {
      throw new Error('Invalid backup payload: malformed astronaut profile entry.');
    }
  }

  const categoryArrays: Array<{
    expectedCategory: 'blood' | 'sleep' | 'cardiovascular';
    items: unknown[];
  }> = [
    { expectedCategory: 'blood', items: payload.blood_records },
    { expectedCategory: 'sleep', items: payload.sleep_records },
    { expectedCategory: 'cardiovascular', items: payload.cardiovascular_records },
  ];

  for (const { expectedCategory, items } of categoryArrays) {
    for (const item of items) {
      if (
        !isRecordObject(item) ||
        typeof item.id !== 'string' ||
        !item.id.trim() ||
        item.category !== expectedCategory
      ) {
        throw new Error(
          `Invalid backup payload: malformed ${expectedCategory} record entry.`,
        );
      }
      const validation = validateHealthRecordInput(
        item as unknown as HealthRecordInput,
      );
      if (!validation.valid) {
        throw new Error(
          `Invalid backup payload: ${expectedCategory} record "${item.id}" failed schema validation (${validation.errors[0]?.message ?? 'unknown error'}).`,
        );
      }
    }
  }

  for (const ctx of payload.mission_contexts) {
    if (
      !isRecordObject(ctx) ||
      typeof ctx.context_id !== 'string' ||
      !ctx.context_id.trim() ||
      typeof ctx.astronaut_id !== 'string' ||
      !ctx.astronaut_id.trim() ||
      typeof ctx.mission_id !== 'string' ||
      !ctx.mission_id.trim()
    ) {
      throw new Error('Invalid backup payload: malformed mission_context entry.');
    }
  }

  for (const batch of payload.import_batches) {
    if (
      !isRecordObject(batch) ||
      typeof batch.batch_id !== 'string' ||
      !batch.batch_id.trim() ||
      typeof batch.profile_id !== 'string' ||
      !batch.profile_id.trim()
    ) {
      throw new Error('Invalid backup payload: malformed import_batch entry.');
    }
  }

  for (const evt of payload.audit_events) {
    if (
      !isRecordObject(evt) ||
      typeof evt.event_id !== 'string' ||
      !evt.event_id.trim() ||
      typeof evt.profile_id !== 'string' ||
      !evt.profile_id.trim() ||
      typeof evt.action !== 'string' ||
      typeof evt.timestamp !== 'string'
    ) {
      throw new Error('Invalid backup payload: malformed audit_event entry.');
    }
  }

  for (const checkin of dailyCheckIns) {
    if (
      !isRecordObject(checkin) ||
      typeof checkin.id !== 'string' ||
      !checkin.id.trim() ||
      typeof checkin.profile_id !== 'string' ||
      !checkin.profile_id.trim() ||
      typeof checkin.checkin_date !== 'string'
    ) {
      throw new Error('Invalid backup payload: malformed daily_checkin entry.');
    }
  }

  for (const request of medicalReviewRequests) {
    if (
      !isRecordObject(request) ||
      typeof request.id !== 'string' ||
      !request.id.trim() ||
      typeof request.profile_id !== 'string' ||
      !request.profile_id.trim() ||
      !Array.isArray(request.record_ids) ||
      !Array.isArray(request.checkin_ids)
    ) {
      throw new Error('Invalid backup payload: malformed medical_review_request entry.');
    }
  }
}

/**
 * Restores a previously exported local backup after verifying its SHA-256
 * checksum and validating every record schema before writing to IndexedDB.
 *
 * Note: SHA-256 verifies payload integrity only; it does not provide
 * encryption or cryptographic authentication.
 */
export async function restoreLocalBackup(
  payload: LocalBackupPayload,
  options: { overwriteExisting?: boolean } = {},
): Promise<{ restoredRecords: number }> {
  validateBackupPayloadStructure(payload);

  const { checksum_sha256, ...body } = payload;
  const expectedChecksum = await computeSha256Hex(JSON.stringify(body));
  if (checksum_sha256 !== expectedChecksum) {
    throw new Error('Backup integrity check failed: SHA-256 checksum mismatch.');
  }

  const db = await initializeDatabase();
  const overwrite = options.overwriteExisting ?? false;

  const profiles = payload.profiles as LocalAstronautProfile[];
  const bloodRecords = payload.blood_records as Extract<
    HealthRecord,
    { category: 'blood' }
  >[];
  const sleepRecords = payload.sleep_records as Extract<
    HealthRecord,
    { category: 'sleep' }
  >[];
  const cardioRecords = payload.cardiovascular_records as Extract<
    HealthRecord,
    { category: 'cardiovascular' }
  >[];
  const missionContexts = payload.mission_contexts as MissionContext[];
  const importBatches = payload.import_batches as ImportBatch[];
  const auditEvents = payload.audit_events as AuditEvent[];
  const dailyCheckIns = (payload.daily_checkins ?? []) as DailyCheckIn[];
  const medicalReviewRequests = (payload.medical_review_requests ?? []) as MedicalReviewRequest[];

  await db.transaction(
    'rw',
    [
      db.profiles,
      db.blood_records,
      db.sleep_records,
      db.cardiovascular_records,
      db.mission_contexts,
      db.import_batches,
      db.audit_events,
      db.daily_checkins,
      db.medical_review_requests,
    ],
    async () => {
      if (overwrite) {
        if (profiles.length) await db.profiles.bulkPut(profiles);
        if (bloodRecords.length) await db.blood_records.bulkPut(bloodRecords);
        if (sleepRecords.length) await db.sleep_records.bulkPut(sleepRecords);
        if (cardioRecords.length) await db.cardiovascular_records.bulkPut(cardioRecords);
        if (missionContexts.length) await db.mission_contexts.bulkPut(missionContexts);
        if (importBatches.length) await db.import_batches.bulkPut(importBatches);
        if (auditEvents.length) await db.audit_events.bulkPut(auditEvents);
        if (dailyCheckIns.length) await db.daily_checkins.bulkPut(dailyCheckIns);
        if (medicalReviewRequests.length) {
          await db.medical_review_requests.bulkPut(medicalReviewRequests);
        }
      } else {
        for (const p of profiles) {
          if (!(await db.profiles.get(p.astronaut_id))) {
            await db.profiles.add(p);
          }
        }
        for (const r of bloodRecords) {
          if (!(await db.blood_records.get(r.id))) {
            await db.blood_records.add(r);
          }
        }
        for (const r of sleepRecords) {
          if (!(await db.sleep_records.get(r.id))) {
            await db.sleep_records.add(r);
          }
        }
        for (const r of cardioRecords) {
          if (!(await db.cardiovascular_records.get(r.id))) {
            await db.cardiovascular_records.add(r);
          }
        }
        for (const c of missionContexts) {
          if (!(await db.mission_contexts.get(c.context_id))) {
            await db.mission_contexts.add(c);
          }
        }
        for (const b of importBatches) {
          if (!(await db.import_batches.get(b.batch_id))) {
            await db.import_batches.add(b);
          }
        }
        for (const e of auditEvents) {
          if (!(await db.audit_events.get(e.event_id))) {
            await db.audit_events.add(e);
          }
        }
        for (const checkin of dailyCheckIns) {
          if (!(await db.daily_checkins.get(checkin.id))) {
            await db.daily_checkins.add(checkin);
          }
        }
        for (const request of medicalReviewRequests) {
          if (!(await db.medical_review_requests.get(request.id))) {
            await db.medical_review_requests.add(request);
          }
        }
      }
    },
  );

  return {
    restoredRecords:
      bloodRecords.length + sleepRecords.length + cardioRecords.length,
  };
}
