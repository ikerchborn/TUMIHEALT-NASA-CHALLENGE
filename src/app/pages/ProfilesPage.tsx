import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  createLocalProfile,
  deleteLocalProfileData,
  exportLocalBackup,
  exportRecordsToSafeCsv,
  getLatestMissionContext,
  getProfileAuditHistory,
  getRecords,
  restoreLocalBackup,
  getLocalStorageInfo,
  requestPersistentStorage,
  saveMissionContext,
} from '@/services';
import type { AuditEvent, GravityEnvironment, LocalBackupPayload, MissionPhase } from '@/types';
import type { LocalStorageInfo } from '@/services/storage';
import { useProfile } from '../context/ProfileContext';
import { Alert, Button, Card, EmptyState, Field, PageHeader, inputClass } from '../components/ui';

export function ProfilesPage() {
  const { profiles, realProfiles, active, isDemoMode, selectProfile, refreshProfiles, enterDemoMode, exitDemoMode } = useProfile();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageInfo, setStorageInfo] = useState<LocalStorageInfo | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageRequestMessage, setStorageRequestMessage] = useState<string | null>(null);

  // Mission Context state
  const [missionId, setMissionId] = useState('');
  const [missionPhase, setMissionPhase] = useState<MissionPhase>('inflight');
  const [envType, setEnvType] = useState('ISS / Orbital');
  const [gravity, setGravity] = useState<GravityEnvironment>('microgravity');
  const [missionStartDate, setMissionStartDate] = useState('');
  const [missionMsg, setMissionMsg] = useState<string | null>(null);

  // Backup / Export state
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupErr, setBackupErr] = useState<string | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getLocalStorageInfo()
      .then((info) => {
        if (!cancelled) {
          setStorageInfo(info);
          setStorageError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setStorageError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setAuditHistory([]);
      return;
    }
    void getLatestMissionContext(active.astronaut_id).then((ctx) => {
      if (ctx) {
        setMissionId(ctx.mission_id);
        setMissionPhase(ctx.mission_phase);
        setEnvType(ctx.environment_type);
        setGravity(ctx.gravity_environment);
        setMissionStartDate(ctx.mission_start_date ?? '');
      } else {
        setMissionId('');
        setMissionStartDate('');
      }
    });
    void getProfileAuditHistory(active.astronaut_id).then((events) => {
      setAuditHistory(events.slice(0, 15));
    });
  }, [active]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const isFirstPersonalProfile = realProfiles.length === 0;
      const profile = await createLocalProfile({
        astronaut_id: id.trim(),
        display_name: name.trim(),
        mission_role: role.trim() || undefined,
      });
      if (isFirstPersonalProfile) {
        const result = await requestPersistentStorage();
        setStorageRequestMessage(
          result.status === 'error'
            ? `Profile created, but the browser could not request persistent storage: ${result.message}`
            : `Persistent browser storage request: ${result.status}.`,
        );
        setStorageInfo(await getLocalStorageInfo());
      }
      await refreshProfiles();
      selectProfile(profile.astronaut_id);
      setId('');
      setName('');
      setRole('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(astronautId: string, displayName: string) {
    if (!window.confirm(`Delete ${displayName} and ALL their local records? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteLocalProfileData(astronautId);
      await refreshProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onSaveMission(e: FormEvent) {
    e.preventDefault();
    if (!active) return;
    setMissionMsg(null);
    setError(null);
    try {
      await saveMissionContext({
        astronaut_id: active.astronaut_id,
        mission_id: missionId.trim(),
        mission_phase: missionPhase,
        environment_type: envType.trim() || 'unknown',
        gravity_environment: gravity,
        mission_start_date: missionStartDate || undefined,
      });
      setMissionMsg(`Mission context saved for ${active.display_name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onExportBackup() {
    if (isDemoMode) {
      setBackupErr('Backup and export are unavailable in Demo Mode. Exit Demo Mode to manage personal data.');
      return;
    }
    setBackupErr(null);
    setBackupMsg(null);
    try {
      const payload = await exportLocalBackup(active?.astronaut_id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tumi-healt-backup-${active?.astronaut_id ?? 'all'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg(`Exported JSON backup (SHA-256 integrity checksum: ${payload.checksum_sha256.slice(0, 12)}…).`);
    } catch (err) {
      setBackupErr(err instanceof Error ? err.message : String(err));
    }
  }

  async function onExportCsv() {
    if (isDemoMode) {
      setBackupErr('Backup and export are unavailable in Demo Mode. Exit Demo Mode to manage personal data.');
      return;
    }
    if (!active) return;
    setBackupErr(null);
    setBackupMsg(null);
    try {
      const recs = await getRecords({ astronaut_id: active.astronaut_id });
      const csv = exportRecordsToSafeCsv(recs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tumi-healt-${active.astronaut_id}-records.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMsg(`Exported ${recs.length} personal records to formula-safe CSV.`);
    } catch (err) {
      setBackupErr(err instanceof Error ? err.message : String(err));
    }
  }

  async function onRestoreBackup(e: ChangeEvent<HTMLInputElement>) {
    if (isDemoMode) {
      setBackupErr('Restore is unavailable in Demo Mode. Exit Demo Mode before restoring personal data.');
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupErr(null);
    setBackupMsg(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as LocalBackupPayload;
      const summary = await restoreLocalBackup(payload, { overwriteExisting: false });
      await refreshProfiles();
      setBackupMsg(
        `Backup restored (merge): ${summary.restoredRecords} records restored.`,
      );
    } catch (err) {
      setBackupErr(err instanceof Error ? err.message : String(err));
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data and Privacy · Profile, Mission & Local Storage"
        title="My Mission & Privacy"
        subtitle="Manage your astronaut profile, mission context, local storage, backups, and activity history."
      />

      <Card title="Data Privacy & Local Storage">
        <ul className="grid gap-3 text-sm leading-relaxed text-slate-200 sm:grid-cols-2">
          <li>• <strong>Local-first storage:</strong> Personal measurements are stored locally in your browser using IndexedDB.</li>
          <li>• <strong>No automatic encryption:</strong> Browser storage is not automatically encrypted at rest.</li>
          <li>• <strong>Browser data clearing:</strong> Clearing browser site data can permanently remove local records — export JSON backups regularly.</li>
          <li>• <strong>No strong authentication:</strong> Selecting an astronaut profile separates data logically, not as user authentication.</li>
        </ul>
        <div className="mt-4 rounded-control border border-mission-border bg-slate-950/40 p-4 text-sm">
          <p>
            <strong>Persistent storage:</strong>{' '}
            {storageInfo?.persistence ?? (storageError ? 'status unavailable' : 'checking…')}
          </p>
          <p className="mt-1 text-slate-300">
            <strong>Browser storage used / quota:</strong>{' '}
            {storageInfo?.usage === undefined
              ? 'usage unavailable'
              : `${(storageInfo.usage / 1_048_576).toFixed(2)} MiB`}
            {' / '}
            {storageInfo?.quota === undefined
              ? 'quota unavailable'
              : `${(storageInfo.quota / 1_048_576).toFixed(2)} MiB`}
          </p>
          {storageInfo?.persistence === 'not granted' && (
            <p className="mt-2 text-amber-200">
              The browser may evict local data under storage pressure. Export a backup regularly.
            </p>
          )}
          {storageError && <p className="mt-2 text-rose-200">Storage status could not be read: {storageError}</p>}
          {storageRequestMessage && <Alert kind="info">{storageRequestMessage}</Alert>}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-mission-border pt-4">
          <p className="text-sm text-slate-300">
            {isDemoMode
              ? 'Demo Mode is active. Synthetic demo data is isolated from your personal profiles.'
              : 'Explore TUMI-HEALT with synthetic example data kept separate from your personal profile.'}
          </p>
          {isDemoMode ? (
            <Button type="button" variant="ghost" onClick={() => void exitDemoMode()}>
              Exit Demo Mode
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => void enterDemoMode()}>
              Explore Demo Data
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="New Profile">
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Astronaut ID">
              <input className={inputClass} value={id} onChange={(e) => setId(e.target.value)} placeholder="astro-01" required />
            </Field>
            <Field label="Name">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" required />
            </Field>
            <Field label="Mission role (optional)">
              <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Flight Engineer" />
            </Field>
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Creating…' : 'Create Profile'}
            </Button>
          </form>
        </Card>

        <Card title={`Local Profiles (${profiles.length})`}>
          {profiles.length === 0 ? (
            <EmptyState>No astronauts yet. Create the first one to get started.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-800">
              {profiles.map((p) => (
                <li key={p.astronaut_id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-white">
                      {p.display_name}
                      {active?.astronaut_id === p.astronaut_id && (
                        <span className="ml-2 rounded bg-cyan-600/20 px-1.5 py-0.5 text-[10px] text-cyan-300">ACTIVE</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-300">
                      {p.astronaut_id}
                      {p.mission_role ? ` · ${p.mission_role}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => selectProfile(p.astronaut_id)}>
                      Select
                    </Button>
                    <Button variant="danger" onClick={() => void onDelete(p.astronaut_id, p.display_name)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Mission Context (Active Astronaut)">
          {!active ? (
            <EmptyState>Select or create an astronaut profile to manage mission context.</EmptyState>
          ) : (
            <form onSubmit={onSaveMission} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mission ID">
                  <input
                    className={inputClass}
                    value={missionId}
                    onChange={(e) => setMissionId(e.target.value)}
                    placeholder="ISS-Exp-72"
                    required
                  />
                </Field>
                <Field label="Mission Phase">
                  <select
                    className={inputClass}
                    value={missionPhase}
                    onChange={(e) => setMissionPhase(e.target.value as MissionPhase)}
                  >
                    <option value="preflight">Preflight</option>
                    <option value="launch">Launch</option>
                    <option value="inflight">In-Flight</option>
                    <option value="postflight">Postflight</option>
                    <option value="ground_analog">Ground Analog</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Environment">
                  <input
                    className={inputClass}
                    value={envType}
                    onChange={(e) => setEnvType(e.target.value)}
                    placeholder="ISS / Bedrest / Lunar"
                  />
                </Field>
                <Field label="Gravity Environment">
                  <select
                    className={inputClass}
                    value={gravity}
                    onChange={(e) => setGravity(e.target.value as GravityEnvironment)}
                  >
                    <option value="microgravity">Microgravity</option>
                    <option value="earth_1g">Earth (1g)</option>
                    <option value="lunar_0_16g">Lunar (0.16g)</option>
                    <option value="martian_0_38g">Martian (0.38g)</option>
                    <option value="hypergravity">Hypergravity</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </Field>
              </div>
              <Field label="Mission start date (optional)">
                <input
                  type="date"
                  className={inputClass}
                  value={missionStartDate}
                  onChange={(e) => setMissionStartDate(e.target.value)}
                />
              </Field>
              {missionMsg && <Alert kind="success">{missionMsg}</Alert>}
              <Button type="submit">Save Mission Context</Button>
            </form>
          )}
        </Card>

        <Card title="Local Backup, Restore & Safe Export">
          <div className="space-y-4 text-sm leading-relaxed text-slate-300">
            <p>
              All health records are stored locally in your browser&apos;s IndexedDB (unencrypted). JSON backups include a{' '}
              <strong>SHA-256 checksum</strong> for data integrity verification (not encryption).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onExportBackup()} disabled={isDemoMode}>
                Export JSON Backup
              </Button>
              <Button type="button" variant="ghost" onClick={() => void onExportCsv()} disabled={!active || isDemoMode}>
                Export Personal CSV
              </Button>
            </div>
            {isDemoMode && (
              <p className="rounded-control border border-amber-700/60 bg-amber-950/30 p-3 text-sm text-amber-100">
                Backup, restore, and export are disabled in Demo Mode to keep demonstration and personal data separate. Exit Demo Mode to manage personal data.
              </p>
            )}
            <Field label="Restore JSON Backup (Merge)">
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void onRestoreBackup(e)}
                className={inputClass}
                disabled={isDemoMode}
              />
            </Field>
            {backupMsg && <Alert kind="success">{backupMsg}</Alert>}
            {backupErr && <Alert kind="error">{backupErr}</Alert>}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Data & Activity Log (Audit)">
          {!active ? (
            <EmptyState>Select an active astronaut profile to inspect its local activity log.</EmptyState>
          ) : auditHistory.length === 0 ? (
            <EmptyState>No activity events recorded yet for {active.display_name}.</EmptyState>
          ) : (
            <div className="space-y-2 text-sm">
              {auditHistory.map((ev) => (
                <div
                  key={ev.event_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-200">{ev.action}</span>
                    {ev.category && <span className="text-slate-400">({ev.category})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        ev.status === 'success'
                          ? 'text-emerald-400'
                          : ev.status === 'failure'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                      }
                    >
                      {ev.status}
                    </span>
                    <span className="text-slate-400">{ev.timestamp.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
