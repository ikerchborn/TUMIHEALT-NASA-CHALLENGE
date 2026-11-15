# Local Storage Architecture (IndexedDB + Dexie.js)

## Core Principle

TUMI-HEALT stores all personal astronaut health records locally in the user's browser using **IndexedDB** via **Dexie.js** (`TumiHealthDatabase` in `src/services/storage/db.ts`). The platform does not use a centralized server or cloud database for personal health records.

## Database Schema & Versioning

- **Database Name:** `tumi_healt_local_db`
- **Current Version:** `6`. Versions 1–5 remain unchanged; version 6 additively adds the `medical_review_requests` store.

### Object Stores (Tables)

| Store | Primary Key | Indexes | Purpose |
| --- | --- | --- | --- |
| `profiles` | `astronaut_id` | `display_name`, `created_at` | Local astronaut profiles |
| `blood_records` | `id` | `astronaut_id`, `timestamp`, `indicator`, `import_batch_id`, `[astronaut_id+timestamp]`, `[astronaut_id+indicator]` | Blood biomarker measurements |
| `sleep_records` | `id` | `astronaut_id`, `timestamp`, `indicator`, `import_batch_id`, `[astronaut_id+timestamp]`, `[astronaut_id+indicator]` | Sleep monitoring measurements |
| `cardiovascular_records` | `id` | `astronaut_id`, `timestamp`, `indicator`, `import_batch_id`, `[astronaut_id+timestamp]`, `[astronaut_id+indicator]` | Cardiovascular measurements |
| `import_batches` | `batch_id` | `profile_id`, `category`, `status`, `created_at`, `[profile_id+created_at]` | CSV import batch tracking |
| `audit_events` | `event_id` | `record_id`, `profile_id`, `action`, `timestamp`, `status`, `[profile_id+timestamp]`, `[record_id+timestamp]` | Local operation audit log |
| `mission_contexts` | `context_id` | `astronaut_id`, `mission_id`, `mission_phase`, `recorded_at`, `[astronaut_id+recorded_at]` | Mission phase, environment, and optional start date |
| `research_records` | `record_id` | `category`, `source_dataset`, `source_subject_id`, `indicator`, `study_timepoint`, `[source_dataset+source_subject_id]` | Individual research data, separate from personal records |
| `research_aggregates` | `aggregate_id` | `category`, `source_dataset`, `indicator`, `group_label`, `[source_dataset+indicator]` | Aggregated research data |
| `daily_checkins` | `id` | `profile_id`, `checkin_date`, `created_at`, `[profile_id+checkin_date]`, `[profile_id+created_at]` | Self-reported daily state, energy, symptoms, and note; separate from measurements |
| `medical_review_requests` | `id` | `profile_id`, `status`, `created_at`, `[profile_id+created_at]` | Local-only review summaries with selected record/check-in identifiers and user observations |

## Supported Operations

- Database initialization (`initializeDatabase`) and full local deletion (`deleteLocalDatabase`)
- Profile CRUD and cascade deletion (`createProfile`, `getProfile`, `listProfiles`, `updateProfile`, `deleteProfile`)
- Record CRUD and filtering by `astronaut_id`, `category`, `indicator`, and `dateRange` (`insertRecord`, `getRecordById`, `queryRecords`, `updateRecordById`, `deleteRecordById`)
- Daily check-in upsert by profile and local date, history reads, and profile-cascade deletion; each entry records its origin and source.
- Medical review requests are saved locally with Draft, Pending (local), or Exported status. Profile deletion and demo exit remove that profile's requests. The JSON export is an explicit user download and is not transmitted.

## Important Storage Limitations

- **No Automatic Encryption:** IndexedDB does not encrypt stored records automatically.
- **Browser Eviction / Clearing:** Browser storage can be cleared by the user or evicted by the browser under storage pressure.
- **No Cross-Device Sync:** Local data remains on the specific browser profile and device where it was created.
- **Profile Separation:** Separating records by `astronaut_id` provides logical organization only, not authentication or cryptographic isolation.
