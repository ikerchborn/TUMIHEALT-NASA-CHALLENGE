export type StoragePersistenceStatus = 'granted' | 'not granted' | 'unsupported';

export interface LocalStorageInfo {
  persistence: StoragePersistenceStatus;
  usage?: number;
  quota?: number;
}

export type PersistenceRequestResult =
  | { status: StoragePersistenceStatus }
  | { status: 'error'; message: string };

function getStorageManager(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage;
}

export async function getLocalStorageInfo(): Promise<LocalStorageInfo> {
  const storage = getStorageManager();
  if (!storage) return { persistence: 'unsupported' };

  const persistence =
    typeof storage.persisted === 'function'
      ? (await storage.persisted())
        ? 'granted'
        : 'not granted'
      : 'unsupported';
  const estimate =
    typeof storage.estimate === 'function' ? await storage.estimate() : undefined;

  return {
    persistence,
    ...(estimate?.usage === undefined ? {} : { usage: estimate.usage }),
    ...(estimate?.quota === undefined ? {} : { quota: estimate.quota }),
  };
}

export async function requestPersistentStorage(): Promise<PersistenceRequestResult> {
  const storage = getStorageManager();
  if (!storage || typeof storage.persist !== 'function') {
    return { status: 'unsupported' };
  }

  try {
    return { status: (await storage.persist()) ? 'granted' : 'not granted' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
