import { useEffect, useMemo, useState } from 'react';
import {
  getRecords,
  listDailyCheckIns,
  listMedicalReviewRequests,
  saveMedicalReviewRequest,
} from '@/services';
import type {
  DailyCheckIn,
  HealthRecord,
  MedicalReviewRequest,
  MedicalReviewStatus,
} from '@/types';
import { Alert, Button, Drawer, Field, inputClass } from './ui';

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function statusLabel(status: MedicalReviewStatus): string {
  if (status === 'PENDING_LOCAL') return 'Pending (local)';
  return status === 'EXPORTED' ? 'Exported' : 'Draft';
}

function checkInSummary(checkin: DailyCheckIn): string {
  const mood = checkin.mood.replaceAll('_', ' ');
  const symptoms = checkin.symptoms.length > 0 ? checkin.symptoms.join(', ') : 'no symptoms selected';
  return `${mood}; energy ${checkin.energy_level}/5; ${symptoms}`;
}

function recordSummary(record: HealthRecord): string {
  return `${record.indicator}: ${record.value ?? 'value unavailable'} ${record.unit}`;
}

export function MedicalReviewDrawer({
  open,
  onClose,
  profileId,
  isDemoMode,
}: {
  open: boolean;
  onClose: () => void;
  profileId?: string;
  isDemoMode: boolean;
}) {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckIn[]>([]);
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [selectedCheckinIds, setSelectedCheckinIds] = useState<string[]>([]);
  const [from, setFrom] = useState(() => localDateKey(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => localDateKey(new Date()));
  const [observations, setObservations] = useState('');
  const [requestId, setRequestId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!open || !profileId) return;

    setLoading(true);
    Promise.all([
      getRecords({ astronaut_id: profileId }),
      listDailyCheckIns(profileId),
      listMedicalReviewRequests(profileId),
    ])
      .then(([recordRows, checkinRows, requestRows]) => {
        if (cancelled) return;
        setRecords(recordRows);
        setCheckins(checkinRows);
        setRequests(requestRows);
        setSelectedRecordIds([]);
        setSelectedCheckinIds([]);
        setRequestId(undefined);
        setObservations('');
        setError(undefined);
        setMessage(undefined);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, profileId]);

  const rangedRecords = useMemo(
    () => records.filter((record) => record.timestamp.slice(0, 10) >= from && record.timestamp.slice(0, 10) <= to),
    [records, from, to],
  );
  const rangedCheckins = useMemo(
    () => checkins.filter((checkin) => checkin.checkin_date >= from && checkin.checkin_date <= to),
    [checkins, from, to],
  );

  function toggleId(id: string, selected: string[], update: (ids: string[]) => void) {
    update(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  async function persist(status: MedicalReviewStatus): Promise<MedicalReviewRequest> {
    if (!profileId) throw new Error('Choose a profile before saving a review request.');
    const saved = await saveMedicalReviewRequest({
      ...(requestId ? { id: requestId } : {}),
      profile_id: profileId,
      date_range: { from, to },
      record_ids: selectedRecordIds,
      checkin_ids: selectedCheckinIds,
      observations,
      status,
      data_origin: isDemoMode ? 'SYNTHETIC' : 'SELF_REPORTED',
      source: 'medical_review_drawer',
    });
    setRequestId(saved.id);
    setRequests((current) => [saved, ...current.filter((request) => request.id !== saved.id)]);
    return saved;
  }

  async function handleSave(status: MedicalReviewStatus) {
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const saved = await persist(status);
      setMessage(`Request saved locally as ${statusLabel(saved.status)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const saved = await persist('EXPORTED');
      const payload = {
        request: saved,
        measurements: records.filter((record) => selectedRecordIds.includes(record.id)),
        checkins: checkins.filter((checkin) => selectedCheckinIds.includes(checkin.id)),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `medical-review-${saved.id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('A JSON copy was downloaded. No information was sent to a medical team.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="Request medical review" onClose={onClose}>
      <div className="space-y-5">
        <Alert kind="info">
          No connection to the medical team exists in this app. Your request is saved locally. Export creates a file for you to share through an authorized channel; it does not transmit the file.
        </Alert>
        {isDemoMode && (
          <Alert kind="warn">
            Demo requests use synthetic data, are deleted when demo mode ends, and cannot be exported.
          </Alert>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave('PENDING_LOCAL');
          }}
        >
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-slate-200">Date range</legend>
            <Field label="From">
              <input className={inputClass} type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To">
              <input className={inputClass} type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </Field>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-200">Measurements</legend>
            {loading ? (
              <p className="text-sm text-slate-400">Loading profile records…</p>
            ) : rangedRecords.length === 0 ? (
              <p className="text-sm text-slate-400">No measurements in this date range.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-auto rounded-control border border-mission-border p-3">
                {rangedRecords.map((record) => (
                  <li key={record.id}>
                    <label className="flex items-start gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.id)}
                        onChange={() => toggleId(record.id, selectedRecordIds, setSelectedRecordIds)}
                        className="mt-1 accent-cyan-400"
                      />
                      <span>{recordSummary(record)} · {record.timestamp.slice(0, 10)} · {record.data_origin}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-200">Check-ins and symptoms</legend>
            {rangedCheckins.length === 0 ? (
              <p className="text-sm text-slate-400">No check-ins in this date range.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-auto rounded-control border border-mission-border p-3">
                {rangedCheckins.map((checkin) => (
                  <li key={checkin.id}>
                    <label className="flex items-start gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedCheckinIds.includes(checkin.id)}
                        onChange={() => toggleId(checkin.id, selectedCheckinIds, setSelectedCheckinIds)}
                        className="mt-1 accent-cyan-400"
                      />
                      <span>{checkin.checkin_date} · {checkInSummary(checkin)} · {checkin.data_origin === 'SYNTHETIC' ? 'Synthetic' : 'Self-reported'}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <Field label="Your observations (optional)" hint="These notes stay on this device unless you download the summary.">
            <textarea
              className={inputClass}
              rows={3}
              maxLength={1000}
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              placeholder="What would you like the medical team to review?"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={() => void handleSave('DRAFT')}>
              Save draft
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save pending request'}
            </Button>
            <Button type="button" variant="ghost" disabled={saving || isDemoMode} onClick={() => void handleExport()}>
              Download JSON
            </Button>
          </div>
        </form>

        {requests.length > 0 && (
          <section aria-labelledby="local-review-history" className="border-t border-mission-border pt-4">
            <h3 id="local-review-history" className="text-sm font-semibold text-white">Local request history</h3>
            <ul className="mt-2 space-y-2">
              {requests.slice(0, 5).map((request) => (
                <li key={request.id} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{request.created_at.slice(0, 10)}</span>
                  <span className="text-slate-300">{statusLabel(request.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
