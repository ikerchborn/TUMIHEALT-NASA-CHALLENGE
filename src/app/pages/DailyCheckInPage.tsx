import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getDailyCheckIn,
  getLocalCheckInDate,
  listDailyCheckIns,
  saveDailyCheckIn,
} from '@/services';
import type {
  DailyCheckIn,
  DailyCheckInMood,
  DailyCheckInSymptom,
} from '@/types';
import { useProfile } from '../context/ProfileContext';
import { Alert, Button, Card, EmptyState, Field, PageHeader, inputClass } from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';

const moods: Array<{ value: DailyCheckInMood; label: string }> = [
  { value: 'good', label: 'Good' },
  { value: 'a_bit_tired', label: 'A bit tired' },
  { value: 'very_fatigued', label: 'Very fatigued' },
  { value: 'unwell', label: 'I feel unwell' },
];

const symptomOptions: Array<{ value: DailyCheckInSymptom; label: string }> = [
  { value: 'headache', label: 'Headache' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'other', label: 'Other' },
];

function formatCheckInDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSymptoms(record: DailyCheckIn): string {
  return record.symptoms
    .map((symptom) => {
      const label = symptomOptions.find((option) => option.value === symptom)?.label ?? symptom;
      return symptom === 'other' && record.other_symptom
        ? `${label}: ${record.other_symptom}`
        : label;
    })
    .join(', ');
}

export function DailyCheckInPage() {
  const { active, isDemoMode } = useProfile();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [todayCheckIn, setTodayCheckIn] = useState<DailyCheckIn>();
  const [history, setHistory] = useState<DailyCheckIn[]>([]);
  const [mood, setMood] = useState<DailyCheckInMood>('good');
  const [energy, setEnergy] = useState(3);
  const [symptoms, setSymptoms] = useState<DailyCheckInSymptom[]>([]);
  const [otherSymptom, setOtherSymptom] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const profileId = active?.astronaut_id;
  const today = getLocalCheckInDate();

  useEffect(() => {
    let cancelled = false;
    if (!profileId) {
      setTodayCheckIn(undefined);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([getDailyCheckIn(profileId, today), listDailyCheckIns(profileId)])
      .then(([current, records]) => {
        if (cancelled) return;
        setTodayCheckIn(current);
        setHistory(records.filter((record) => record.checkin_date !== today));
        if (current) {
          setMood(current.mood);
          setEnergy(current.energy_level);
          setSymptoms(current.symptoms);
          setOtherSymptom(current.other_symptom ?? '');
          setNote(current.note ?? '');
        } else {
          setMood('good');
          setEnergy(3);
          setSymptoms([]);
          setOtherSymptom('');
          setNote('');
        }
        setError(null);
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
  }, [profileId, today]);

  function toggleSymptom(symptom: DailyCheckInSymptom) {
    setSymptoms((selected) =>
      selected.includes(symptom)
        ? selected.filter((item) => item !== symptom)
        : [...selected, symptom],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const saved = await saveDailyCheckIn({
        profile_id: profileId,
        checkin_date: today,
        mood,
        energy_level: energy,
        symptoms,
        other_symptom: otherSymptom || undefined,
        note: note || undefined,
        data_origin: isDemoMode ? 'SYNTHETIC' : 'SELF_REPORTED',
        source: isDemoMode ? 'synthetic_demo_fixture' : 'daily_check_in',
      });
      setTodayCheckIn(saved);
      setSavedMessage('Your daily self-report is saved on this device. You can edit it again today.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const selectedSymptomLabels = todayCheckIn?.symptoms
    .map((symptom) => symptomOptions.find((option) => option.value === symptom)?.label ?? symptom)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily Check-in · Self-report"
        title="How are you today?"
        subtitle="This is a self-reported state, not a medical measurement. Your check-in is stored locally with your active profile."
      />

      {!active && <EmptyState>Select a profile before saving a daily check-in.</EmptyState>}
      {error && <Alert kind="error">{error}</Alert>}
      {savedMessage && <Alert kind="success">{savedMessage}</Alert>}
      {loading && <p className="text-sm text-slate-400">Loading your check-in…</p>}

      {active && !loading && (
        <Card title={todayCheckIn ? 'Today’s check-in' : 'Today’s self-report'}>
          {todayCheckIn && (
            <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
              <p className="font-medium text-white">
                {moods.find((option) => option.value === todayCheckIn.mood)?.label} · Energy {todayCheckIn.energy_level} of 5
              </p>
              <p className="mt-1 text-slate-300">
                {selectedSymptomLabels || 'No symptoms selected'}
                {todayCheckIn.other_symptom ? `: ${todayCheckIn.other_symptom}` : ''}
              </p>
              {todayCheckIn.note && <p className="mt-2 text-slate-400">{todayCheckIn.note}</p>}
              <p className="mt-2 text-xs text-slate-400">
                {todayCheckIn.data_origin === 'SYNTHETIC' ? 'Synthetic demo example' : 'Self-reported'} · {todayCheckIn.updated_at === todayCheckIn.created_at ? 'Saved' : 'Edited'} today
              </p>
            </div>
          )}

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-200">How are you feeling?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {moods.map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                      mood === option.value
                        ? 'border-cyan-500 bg-cyan-950/50 text-white'
                        : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mood"
                      value={option.value}
                      checked={mood === option.value}
                      onChange={() => setMood(option.value)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label={`Energy level: ${energy} of 5`} hint="1 means very low energy; 5 means high energy.">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={energy}
                onChange={(event) => setEnergy(Number(event.target.value))}
                aria-label="Energy level from 1 to 5"
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>Low</span>
                <span>High</span>
              </div>
            </Field>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-200">Any symptoms?</legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={symptoms.length === 0}
                  onClick={() => setSymptoms([])}
                  className={`rounded-full border px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    symptoms.length === 0
                      ? 'border-cyan-500 bg-cyan-950/50 text-white'
                      : 'border-slate-700 text-slate-300'
                  }`}
                >
                  None
                </button>
                {symptomOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={symptoms.includes(option.value)}
                    onClick={() => toggleSymptom(option.value)}
                    className={`rounded-full border px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      symptoms.includes(option.value)
                        ? 'border-cyan-500 bg-cyan-950/50 text-white'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {symptoms.includes('other') && (
              <Field label="Other symptom (optional)">
                <input
                  className={inputClass}
                  value={otherSymptom}
                  onChange={(event) => setOtherSymptom(event.target.value)}
                  maxLength={160}
                  placeholder="Add a short description"
                />
              </Field>
            )}

            <Field label="Note (optional)">
              <textarea
                className={inputClass}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                placeholder="Anything else you would like to note?"
              />
            </Field>

            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : todayCheckIn ? 'Save changes' : 'Save check-in'}
            </Button>
          </form>

          {savedMessage && (mood === 'unwell' || symptoms.length > 0) && (
            <div className="mt-5 space-y-3">
              <Alert kind="info">
                If you are concerned about how you feel, follow your mission medical protocol. This app does not provide a diagnosis.
              </Alert>
              <Button type="button" variant="ghost" onClick={() => setReviewOpen(true)}>
                Request medical review
              </Button>
              <p className="text-xs text-slate-400">
                You can save the request locally; this app cannot send a message to the medical team.
              </p>
            </div>
          )}
        </Card>
      )}

      <Card title="Previous check-ins" subtitle="Your history is shown for this profile only.">
        {loading ? (
          <p className="text-sm text-slate-400">Loading check-in history…</p>
        ) : history.length === 0 ? (
          <EmptyState>No previous check-ins recorded.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-800">
            {history.map((record) => (
              <li key={record.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white">
                    {formatCheckInDate(record.checkin_date)} · {moods.find((option) => option.value === record.mood)?.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Energy {record.energy_level} of 5 · {formatSymptoms(record) || 'No symptoms selected'}
                  </p>
                  {record.note && <p className="mt-1 text-sm text-slate-400">{record.note}</p>}
                </div>
                <span className="text-xs text-slate-400">
                  {record.data_origin === 'SYNTHETIC' ? 'Synthetic demo example' : 'Self-reported'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-slate-400">
        Self-reported information is separate from imported health measurements.{' '}
        <Link to="/" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">Return to Mission Home</Link>
      </p>
      <MedicalReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        profileId={profileId}
        isDemoMode={isDemoMode}
      />
    </div>
  );
}
