import Dexie, { type EntityTable } from 'dexie';
import type {
  AuditEvent,
  BloodRecord,
  CardiovascularRecord,
  ImportBatch,
  LocalAstronautProfile,
  MissionContext,
  SleepRecord,
} from '@/types';

export const DATABASE_NAME = 'tumi_healt_local_db';
export const DATABASE_VERSION = 3;

/**
 * Local IndexedDB database powered by Dexie.js.
 *
 * All personal astronaut health records are persisted locally in the user's
 * browser. IndexedDB does not automatically encrypt stored data, and browser
 * storage can be cleared or evicted by the user or host environment.
 */
export class TumiHealthDatabase extends Dexie {
  profiles!: EntityTable<LocalAstronautProfile, 'astronaut_id'>;
  blood_records!: EntityTable<BloodRecord, 'id'>;
  sleep_records!: EntityTable<SleepRecord, 'id'>;
  cardiovascular_records!: EntityTable<CardiovascularRecord, 'id'>;
  import_batches!: EntityTable<ImportBatch, 'batch_id'>;
  audit_events!: EntityTable<AuditEvent, 'event_id'>;
  mission_contexts!: EntityTable<MissionContext, 'context_id'>;

  constructor(dbName: string = DATABASE_NAME) {
    super(dbName);

    // Version 1: Initial local profile and category record stores
    this.version(1).stores({
      profiles: 'astronaut_id, display_name, created_at',
      blood_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
      sleep_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
      cardiovascular_records:
        'id, astronaut_id, timestamp, indicator, [astronaut_id+timestamp], [astronaut_id+indicator]',
    });

    // Version 2: Add CSV import batch tracking and local audit trail stores
    this.version(2)
      .stores({
        profiles: 'astronaut_id, display_name, created_at',
        blood_records:
          'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
        sleep_records:
          'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
        cardiovascular_records:
          'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
        import_batches:
          'batch_id, profile_id, category, status, created_at, [profile_id+created_at]',
        audit_events:
          'event_id, record_id, profile_id, action, timestamp, status, [profile_id+timestamp], [record_id+timestamp]',
      })
      .upgrade(async (tx) => {
        const tables = ['blood_records', 'sleep_records', 'cardiovascular_records'] as const;
        for (const tableName of tables) {
          await tx
            .table(tableName)
            .toCollection()
            .modify((record: Record<string, unknown>) => {
              if (!record.ingestion_method) {
                record.ingestion_method = 'MANUAL';
              }
            });
        }
      });

    // Version 3: Add mission_contexts store for operational & environmental context
    this.version(DATABASE_VERSION).stores({
      profiles: 'astronaut_id, display_name, created_at',
      blood_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      sleep_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      cardiovascular_records:
        'id, astronaut_id, timestamp, indicator, import_batch_id, [astronaut_id+timestamp], [astronaut_id+indicator]',
      import_batches:
        'batch_id, profile_id, category, status, created_at, [profile_id+created_at]',
      audit_events:
        'event_id, record_id, profile_id, action, timestamp, status, [profile_id+timestamp], [record_id+timestamp]',
      mission_contexts:
        'context_id, astronaut_id, mission_id, mission_phase, recorded_at, [astronaut_id+recorded_at]',
    });
  }
}

let dbInstance: TumiHealthDatabase | null = null;

/**
 * Returns the singleton database instance, creating it if needed.
 */
export function getDatabase(dbName: string = DATABASE_NAME): TumiHealthDatabase {
  if (!dbInstance || dbInstance.name !== dbName) {
    dbInstance = new TumiHealthDatabase(dbName);
  }
  return dbInstance;
}

/**
 * Explicitly opens and initializes the IndexedDB database.
 */
export async function initializeDatabase(
  dbName: string = DATABASE_NAME,
): Promise<TumiHealthDatabase> {
  const db = getDatabase(dbName);
  if (!db.isOpen()) {
    await db.open();
  }
  return db;
}

/**
 * Closes the active database connection without deleting stored data.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Deletes the entire local IndexedDB database and resets the singleton.
 */
export async function deleteLocalDatabase(
  dbName: string = DATABASE_NAME,
): Promise<void> {
  const db = getDatabase(dbName);
  await db.delete();
  dbInstance = null;
}
