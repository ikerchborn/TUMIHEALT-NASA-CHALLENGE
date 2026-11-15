import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLocalProfile, requestPersistentStorage } from '@/services';
import { useProfile } from '../context/ProfileContext';
import { BodyFigure } from '../components/BodyFigure';
import { Alert, Button, Field, StepProgress, inputClass } from '../components/ui';

type OnboardingStep = 'welcome' | 'create-profile' | 'choose-start';

const ROLE_OPTIONS = [
  'Mission Specialist',
  'Commander',
  'Pilot',
  'Flight Engineer',
  'Payload Specialist',
  'Medical / Science Officer',
];

export function WelcomePage() {
  const navigate = useNavigate();
  const { realProfiles, refreshProfiles, selectProfile, enterDemoMode } = useProfile();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [name, setName] = useState('');
  const [astronautId, setAstronautId] = useState('');
  const [role, setRole] = useState('Mission Specialist');
  const [createdName, setCreatedName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreateProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanId = astronautId.trim();
    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }
    if (!cleanId) {
      setError('Please enter an Astronaut ID (for example, AST-042).');
      return;
    }

    setBusy(true);
    try {
      const isFirstPersonalProfile = realProfiles.length === 0;
      const created = await createLocalProfile({
        astronaut_id: cleanId,
        display_name: cleanName,
        mission_role: role.trim() || undefined,
      });
      await refreshProfiles();
      selectProfile(created.astronaut_id);
      setCreatedName(created.display_name);
      if (isFirstPersonalProfile) {
        const result = await requestPersistentStorage();
        setStorageMessage(
          result.status === 'error'
            ? `Profile created, but the browser could not request persistent storage: ${result.message}`
            : `Persistent browser storage request: ${result.status}.`,
        );
      }
      setStep('choose-start');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExploreDemo() {
    setBusy(true);
    setError(null);
    try {
      await enterDemoMode();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleContinuePersonal() {
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0d2240_0%,#040914_65%)] text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-10 sm:px-10">
        {step === 'welcome' && (
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium tracking-wide text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                TUMI-HEALT · Astronaut Health System
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Your health. Your mission.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Import your health records, understand your body, and explore how space affects astronauts.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  type="button"
                  onClick={() => setStep('create-profile')}
                  className="rounded-xl px-7 py-3.5 text-base font-semibold shadow-lg shadow-cyan-500/20"
                >
                  Get Started
                </Button>

                {realProfiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-sm font-medium text-slate-400 underline-offset-4 hover:text-cyan-200 hover:underline"
                  >
                    Return to Dashboard
                  </button>
                )}
              </div>
            </div>

            <div className="relative grid min-h-[300px] place-items-center overflow-hidden rounded-3xl border border-cyan-900/50 bg-slate-950/50 p-8 lg:col-span-6 lg:min-h-[440px]">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,0.12),transparent_48%)]"
              />
              <div className="relative max-w-sm text-center">
                <BodyFigure
                  selected={null}
                  interactive={false}
                  calmGlow
                  className="mx-auto mb-4 max-w-[16rem]"
                />
                <p className="text-sm font-semibold text-white">Health tracking for space missions</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Explore blood, sleep, and cardiovascular information in one local workspace.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'create-profile' && (
          <div className="mx-auto w-full max-w-xl space-y-6">
            <StepProgress
              steps={['Create Profile', 'Choose Start']}
              currentStep={0}
            />

            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-6 shadow-xl sm:p-8">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                Let&apos;s create your astronaut profile.
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Only basic details are needed to get started. Your data stays locally in this browser.
              </p>

              <form onSubmit={handleCreateProfile} className="mt-6 space-y-5">
                <Field
                  label="Name"
                  hint="How your name will appear across your health log."
                >
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Maya Lin"
                    autoFocus
                    required
                  />
                </Field>

                <Field
                  label="Astronaut ID"
                  hint="A short identifier for your local profile (e.g., AST-042)."
                >
                  <input
                    className={inputClass}
                    value={astronautId}
                    onChange={(e) => setAstronautId(e.target.value)}
                    placeholder="e.g., AST-042"
                    required
                  />
                </Field>

                <Field
                  label="Role"
                  hint="Your crew or mission role. Optional mission details can be added later."
                >
                  <select
                    className={inputClass}
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>

                {error && <Alert kind="error">{error}</Alert>}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setError(null);
                      setStep('welcome');
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={busy} className="px-6 py-2.5 text-sm">
                    {busy ? 'Creating profile…' : 'Continue'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {step === 'choose-start' && (
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <StepProgress
              steps={['Create Profile', 'Choose Start']}
              currentStep={1}
            />

            <div className="text-center">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                Welcome, {createdName || 'Astronaut'}. How would you like to start?
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                You can switch between your personal profile and the demonstration anytime.
              </p>
            </div>

            {storageMessage && <Alert kind="info">{storageMessage}</Alert>}
            {error && <Alert kind="error">{error}</Alert>}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col justify-between rounded-2xl border border-cyan-500/35 bg-slate-900/75 p-6 transition hover:border-cyan-400">
                <div className="space-y-3">
                  <span className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                    Option A · Personal Log
                  </span>
                  <h2 className="text-xl font-semibold text-white">My Own Health Profile</h2>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Start with your own profile and import your health measurements.
                  </p>
                </div>
                <div className="mt-6">
                  <Button
                    type="button"
                    onClick={handleContinuePersonal}
                    disabled={busy}
                    className="w-full py-3 text-sm"
                  >
                    Continue with My Profile
                  </Button>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-violet-500/35 bg-slate-900/75 p-6 transition hover:border-violet-400">
                <div className="space-y-3">
                  <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
                    Option B · Example Experience
                  </span>
                  <h2 className="text-xl font-semibold text-white">Explore a Demo</h2>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Explore TUMI-HEALT using example data and discover how the system works.
                  </p>
                  <p className="text-xs text-slate-400">
                    Uses clearly labeled synthetic data. Your personal profile remains empty and untouched.
                  </p>
                </div>
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void handleExploreDemo()}
                    disabled={busy}
                    className="w-full border-violet-500/40 bg-violet-600/20 py-3 text-sm text-violet-100 hover:bg-violet-600/35"
                  >
                    {busy ? 'Loading Demo…' : 'Explore Demo'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
