import type {
  AuditAction,
  AuditEvent,
  AuditQueryFilter,
  AuditStatus,
  DataOrigin,
  HealthCategory,
} from '@/types';
import { initializeDatabase } from '@/services/storage/db';

function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const REDACTED_DETAIL_KEYS = new Set([
  'value',
  'previous_values',
  'new_values',
  'deleted_record_snapshot',
  'heart_rate',
  'blood_pressure',
  'cardiac_output',
  'sleep_duration',
  'sleep_efficiency',
  'sleep_latency',
]);

function sanitizeAuditDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!details) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    if (!REDACTED_DETAIL_KEYS.has(key)) {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export interface RecordAuditEventInput {
  record_id?: string;
  profile_id: string;
  action: AuditAction;
  actor_id?: string;
  data_origin?: DataOrigin;
  category?: HealthCategory;
  status: AuditStatus;
  details?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Appends an audit event to the local IndexedDB `audit_events` store.
 *
 * Note: Local IndexedDB audit logs provide operational traceability in the
 * browser, but are not tamper-proof or cryptographically immutable.
 */
export async function recordAuditEvent(
  input: RecordAuditEventInput,
): Promise<AuditEvent> {
  const db = await initializeDatabase();
  const event: AuditEvent = {
    event_id: generateEventId(),
    record_id: input.record_id,
    profile_id: input.profile_id,
    action: input.action,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actor_id: input.actor_id ?? input.profile_id,
    data_origin: input.data_origin,
    category: input.category,
    status: input.status,
    details: sanitizeAuditDetails(input.details),
  };

  await db.audit_events.add(event);
  return event;
}

/**
 * Queries local audit events with optional filters, sorted newest-first.
 */
export async function queryAuditEvents(
  filter: AuditQueryFilter = {},
): Promise<AuditEvent[]> {
  const db = await initializeDatabase();
  let events: AuditEvent[];

  if (filter.record_id) {
    events = await db.audit_events
      .where('record_id')
      .equals(filter.record_id)
      .toArray();
  } else if (filter.profile_id) {
    events = await db.audit_events
      .where('profile_id')
      .equals(filter.profile_id)
      .toArray();
  } else if (filter.action) {
    events = await db.audit_events.where('action').equals(filter.action).toArray();
  } else {
    events = await db.audit_events.toArray();
  }

  const fromMs = filter.from ? Date.parse(filter.from) : undefined;
  const toMs = filter.to ? Date.parse(filter.to) : undefined;

  return events
    .filter((evt) => {
      if (filter.profile_id && evt.profile_id !== filter.profile_id) return false;
      if (filter.record_id && evt.record_id !== filter.record_id) return false;
      if (filter.action && evt.action !== filter.action) return false;
      if (filter.status && evt.status !== filter.status) return false;

      const ts = Date.parse(evt.timestamp);
      if (fromMs !== undefined && !Number.isNaN(fromMs) && ts < fromMs) return false;
      if (toMs !== undefined && !Number.isNaN(toMs) && ts > toMs) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export async function getRecordAuditHistory(
  recordId: string,
): Promise<AuditEvent[]> {
  return queryAuditEvents({ record_id: recordId });
}

export async function getProfileAuditHistory(
  profileId: string,
): Promise<AuditEvent[]> {
  return queryAuditEvents({ profile_id: profileId });
}
