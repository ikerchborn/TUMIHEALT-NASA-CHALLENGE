# Local Audit Trail Architecture

## Purpose

The local audit trail (`src/services/audit/auditService.ts`) records data management operations in the `audit_events` IndexedDB store to provide operational traceability for record creation, modification, deletion, and CSV imports.

## Event Structure

Each `AuditEvent` contains:

- `event_id`: Unique UUID v4 identifier.
- `record_id`: Associated health record ID (when applicable).
- `profile_id`: Associated local astronaut profile ID.
- `action`: `PROFILE_CREATED`, `PROFILE_UPDATED`, `PROFILE_DELETED`, `RECORD_CREATED`, `RECORD_UPDATED`, `RECORD_DELETED`, `IMPORT_VALIDATED`, `IMPORT_CONFIRMED`, `IMPORT_CANCELLED`, or `IMPORT_FAILED`.
- `timestamp`: ISO 8601 timestamp.
- `actor_id`: Identifier of the local actor performing the action.
- `data_origin`: Scientific origin classification when applicable.
- `category`: Health category when applicable.
- `status`: `success`, `warning`, or `failure`.
- `details`: Structured event metadata.

## Audit Rules

- **Modifications (`RECORD_UPDATED`):** Preserve both `previous_values` and `new_values` in `details`.
- **Deletions (`RECORD_DELETED`, `PROFILE_DELETED`):** The audit event is written **before** removing the record or profile from IndexedDB.
- **CSV Imports:** Tracks validation (`IMPORT_VALIDATED`), confirmation (`IMPORT_CONFIRMED`), cancellation (`IMPORT_CANCELLED`), failures (`IMPORT_FAILED`), and per-record creation (`RECORD_CREATED`).

## Security Limitations

A local IndexedDB audit log is **not tamper-proof or cryptographically immutable**. Any user or script with access to the browser's developer tools or IndexedDB storage can inspect, modify, or clear local audit records.
