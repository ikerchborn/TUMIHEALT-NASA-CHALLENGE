import type { DataOrigin, HealthCategory } from './common';

export type AuditAction =
  | 'PROFILE_CREATED'
  | 'PROFILE_UPDATED'
  | 'PROFILE_DELETED'
  | 'RECORD_CREATED'
  | 'RECORD_UPDATED'
  | 'RECORD_DELETED'
  | 'IMPORT_VALIDATED'
  | 'IMPORT_CONFIRMED'
  | 'IMPORT_CANCELLED'
  | 'IMPORT_FAILED';

export type AuditStatus = 'success' | 'warning' | 'failure';

/**
 * Auditable event stored locally in IndexedDB.
 *
 * Note: A local IndexedDB audit log provides operational traceability within
 * the browser, but it is NOT tamper-proof or cryptographically immutable.
 */
export interface AuditEvent {
  event_id: string;
  record_id?: string;
  profile_id: string;
  action: AuditAction;
  timestamp: string;
  actor_id: string;
  data_origin?: DataOrigin;
  category?: HealthCategory;
  status: AuditStatus;
  details: Record<string, unknown>;
}

export interface AuditQueryFilter {
  profile_id?: string;
  record_id?: string;
  action?: AuditAction;
  status?: AuditStatus;
  from?: string;
  to?: string;
}
