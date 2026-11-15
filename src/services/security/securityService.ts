import type { DataOrigin, HealthRecord, LocalBackupPayload } from '@/types';
import { recordAuditEvent } from '@/services/audit';
import { initializeDatabase } from '@/services/storage/db';

export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB safety limit

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

  const origins = Array.from(
    new Set<DataOrigin>([
      ...bloodRecords.map((r) => r.data_origin),
      ...sleepRecords.map((r) => r.data_origin),
      ...cardioRecords.map((r) => r.data_origin),
    ]),
  );

  const body = {
    schema_version: 3,
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

/**
 * Restores a previously exported local backup after verifying its SHA-256 checksum.
 * Uses `bulkPut` only when `overwriteExisting` is true; otherwise uses `bulkAdd`
 * (or skips existing keys) to prevent silent overwrites.
 */
export async function restoreLocalBackup(
  payload: LocalBackupPayload,
  options: { overwriteExisting?: boolean } = {},
): Promise<{ restoredRecords: number }> {
  const { checksum_sha256, ...body } = payload;
  const expectedChecksum = await computeSha256Hex(JSON.stringify(body));
  if (checksum_sha256 !== expectedChecksum) {
    throw new Error('Backup integrity check failed: SHA-256 checksum mismatch.');
  }

  const db = await initializeDatabase();
  const overwrite = options.overwriteExisting ?? false;

  await db.transaction(
    'rw',
    [
      db.profiles,
      db.blood_records,
      db.sleep_records,
      db.cardiovascular_records,
      db.mission_contexts,
    ],
    async () => {
      if (overwrite) {
        if (payload.profiles.length) await db.profiles.bulkPut(payload.profiles as never[]);
        if (payload.blood_records.length)
          await db.blood_records.bulkPut(payload.blood_records as never[]);
        if (payload.sleep_records.length)
          await db.sleep_records.bulkPut(payload.sleep_records as never[]);
        if (payload.cardiovascular_records.length)
          await db.cardiovascular_records.bulkPut(
            payload.cardiovascular_records as never[],
          );
        if (payload.mission_contexts.length)
          await db.mission_contexts.bulkPut(payload.mission_contexts as never[]);
      } else {
        for (const p of payload.profiles as Array<{ astronaut_id: string }>) {
          if (!(await db.profiles.get(p.astronaut_id))) {
            await db.profiles.add(p as never);
          }
        }
        for (const r of payload.blood_records as Array<{ id: string }>) {
          if (!(await db.blood_records.get(r.id))) {
            await db.blood_records.add(r as never);
          }
        }
        for (const r of payload.sleep_records as Array<{ id: string }>) {
          if (!(await db.sleep_records.get(r.id))) {
            await db.sleep_records.add(r as never);
          }
        }
        for (const r of payload.cardiovascular_records as Array<{ id: string }>) {
          if (!(await db.cardiovascular_records.get(r.id))) {
            await db.cardiovascular_records.add(r as never);
          }
        }
        for (const c of payload.mission_contexts as Array<{ context_id: string }>) {
          if (!(await db.mission_contexts.get(c.context_id))) {
            await db.mission_contexts.add(c as never);
          }
        }
      }
    },
  );

  return {
    restoredRecords:
      payload.blood_records.length +
      payload.sleep_records.length +
      payload.cardiovascular_records.length,
  };
}
