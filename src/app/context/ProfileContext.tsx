import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEMO_ASTRONAUT_ID,
  clearDemoProfileAndData,
  ensureDemoProfileAndData,
  initializeDatabase,
  isDemoAstronaut,
  listLocalProfiles,
} from '@/services';
import type { LocalAstronautProfile } from '@/types';

interface ProfileContextValue {
  ready: boolean;
  initializationError: string | null;
  profiles: LocalAstronautProfile[];
  realProfiles: LocalAstronautProfile[];
  active: LocalAstronautProfile | undefined;
  isDemoMode: boolean;
  selectProfile: (astronautId: string) => void;
  refreshProfiles: () => Promise<void>;
  enterDemoMode: () => Promise<void>;
  exitDemoMode: () => Promise<string | null>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);
const STORAGE_KEY = 'tumi-healt:active-profile';
const RETURN_PROFILE_KEY = 'tumi-healt:return-profile';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<LocalAstronautProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const refreshProfiles = useCallback(async () => {
    setProfiles(await listLocalProfiles());
  }, []);

  useEffect(() => {
    void initializeDatabase()
      .then(refreshProfiles)
      .then(() => setReady(true))
      .catch((error: unknown) => {
        setInitializationError(error instanceof Error ? error.message : String(error));
        setReady(true);
      });
  }, [refreshProfiles]);

  const selectProfile = useCallback((id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const enterDemoMode = useCallback(async () => {
    try {
      if (activeId && !isDemoAstronaut(activeId)) {
        localStorage.setItem(RETURN_PROFILE_KEY, activeId);
      }
    } catch {
      /* ignore */
    }
    await ensureDemoProfileAndData();
    await refreshProfiles();
    selectProfile(DEMO_ASTRONAUT_ID);
  }, [activeId, refreshProfiles, selectProfile]);

  const exitDemoMode = useCallback(async (): Promise<string | null> => {
    await clearDemoProfileAndData();
    const remaining = await listLocalProfiles();
    setProfiles(remaining);

    let fallbackId: string | null = null;
    try {
      const saved = localStorage.getItem(RETURN_PROFILE_KEY);
      localStorage.removeItem(RETURN_PROFILE_KEY);
      if (saved && remaining.some((p) => p.astronaut_id === saved)) {
        fallbackId = saved;
      }
    } catch {
      /* ignore */
    }

    if (!fallbackId && remaining.length > 0) {
      fallbackId = remaining[0].astronaut_id;
    }

    if (fallbackId) {
      selectProfile(fallbackId);
    } else {
      setActiveId(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    return fallbackId;
  }, [selectProfile]);

  const realProfiles = useMemo(
    () => profiles.filter((p) => !isDemoAstronaut(p.astronaut_id)),
    [profiles],
  );

  const active = useMemo(
    () => profiles.find((p) => p.astronaut_id === activeId) ?? profiles[0],
    [profiles, activeId],
  );

  const isDemoMode = isDemoAstronaut(active?.astronaut_id);

  const value = useMemo(
    () => ({
      ready,
      initializationError,
      profiles,
      realProfiles,
      active,
      isDemoMode,
      selectProfile,
      refreshProfiles,
      enterDemoMode,
      exitDemoMode,
    }),
    [
      ready,
      initializationError,
      profiles,
      realProfiles,
      active,
      isDemoMode,
      selectProfile,
      refreshProfiles,
      enterDemoMode,
      exitDemoMode,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
