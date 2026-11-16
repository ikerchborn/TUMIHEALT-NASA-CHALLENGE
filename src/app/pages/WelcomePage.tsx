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

export interface TeamMemberCardConfig {
  id: string;
  badgeCode: string;
  photo: string;
  namePlaceholder: string;
  rolePlaceholder: string;
  contributionPlaceholder: string;
  focusTag: string;
}

/**
 * Verified roster for "The Team Behind TUMI-HEALT".
 */
export const TEAM_MEMBERS: readonly TeamMemberCardConfig[] = [
  {
    id: 'team-member-1',
    badgeCode: 'TM-01',
    photo: '/team/luis-chanduvi.jpg',
    namePlaceholder: 'Luis Chanduvi',
    rolePlaceholder: 'Systems Engineering Coordinator',
    contributionPlaceholder:
      'Coordinated systems engineering, local-first browser architecture, IndexedDB isolation, and overall mission software delivery.',
    focusTag: 'Systems & Coordination',
  },
  {
    id: 'team-member-2',
    badgeCode: 'TM-02',
    photo: '/team/jared-poma.jpg',
    namePlaceholder: 'Jared Erick Poma Solís',
    rolePlaceholder: 'Logistics Specialist',
    contributionPlaceholder:
      'Managed mission logistics, operational workflow planning, crew resource tracking, and end-to-end project coordination.',
    focusTag: 'Mission Logistics',
  },
  {
    id: 'team-member-3',
    badgeCode: 'TM-03',
    photo: '/team/ximena-sampen.jpg',
    namePlaceholder: 'Ximena Sampen Reinoso',
    rolePlaceholder: 'Marketing & Design Specialist',
    contributionPlaceholder:
      'Led visual communication, brand identity, mission presentation design, and clear crew-facing messaging.',
    focusTag: 'Marketing & Design',
  },
  {
    id: 'team-member-4',
    badgeCode: 'TM-04',
    photo: '/team/jhony-valdiviezo.jpg',
    namePlaceholder: 'Jhony Valdiviezo',
    rolePlaceholder: 'Electrical & Mechanical Specialist',
    contributionPlaceholder:
      'Contributed hardware-telemetry perspective, sensor integration alignment, and spacecraft instrumentation reliability.',
    focusTag: 'Electrical & Mechanical',
  },
  {
    id: 'team-member-5',
    badgeCode: 'TM-05',
    photo: '/team/astrid-sanchez.jpg',
    namePlaceholder: 'Astrid Sanchez Gonzales',
    rolePlaceholder: 'Systems Engineer · UX/UI Lead',
    contributionPlaceholder:
      'Designed the progressive-disclosure crew interface, high-contrast orbital telemetry layout, and accessible 2D anatomical explorer.',
    focusTag: 'Systems & UX/UI',
  },
  {
    id: 'team-member-6',
    badgeCode: 'TM-06',
    photo: '/team/dariana.jpg',
    namePlaceholder: 'Dariana',
    rolePlaceholder: 'Data Analyst',
    contributionPlaceholder:
      'Structured the biomedical indicator catalog, NASA OSDR/NLSP dataset analysis, and 90-day synthetic health timeline.',
    focusTag: 'Biomedical Data Analysis',
  },
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
    <div className="min-h-screen bg-mission-canvas text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-5 py-8 sm:px-8 lg:px-10">
        {/* Top Centered System Title Banner (Section 8.1) */}
        <header className="mb-8 border-b border-slate-800/80 pb-6 text-center">
          <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-950/60 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Local-First Crew Health &amp; Telemetry Workspace
          </div>
          <h1 className="mx-auto max-w-4xl text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            TUMI-HEALT · Astronaut Health System
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            Understand your health measurements, compare changes against your personal baseline, and know what action to take next during a space mission.
          </p>
        </header>

        {step === 'welcome' && (
          <div className="space-y-14">
            {/* Hero Section (Section 8.2 & 3.4) */}
            <section
              aria-label="Mission health overview and onboarding"
              className="grid items-center gap-8 lg:grid-cols-12 lg:gap-10"
            >
              <div className="space-y-6 lg:col-span-6">
                <div className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1">
                    100% On-Device IndexedDB
                  </span>
                  <span className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-slate-300">
                    NASA OSDR &amp; HRP Grounded
                  </span>
                </div>

                <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Your health. Your mission.
                </h2>

                <p className="max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
                  Built for astronauts with limited time: inspect cardiovascular vitals, sleep actigraphy, and episodic CBC/CMP laboratory results in seconds—with clear explanations for every observation and strict separation between personal and synthetic demo data.
                </p>

                {/* Key capabilities at a glance */}
                <ul className="grid gap-2.5 text-sm text-slate-300 sm:grid-cols-2">
                  <li className="flex items-start gap-2 rounded-xl border border-slate-800/90 bg-slate-900/55 p-3">
                    <span className="mt-0.5 text-cyan-400" aria-hidden="true">●</span>
                    <span>
                      <strong className="text-white">Personal Baseline Comparison:</strong> Tracks 90-day shifts against your own history rather than generic population guesses.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 rounded-xl border border-slate-800/90 bg-slate-900/55 p-3">
                    <span className="mt-0.5 text-emerald-400" aria-hidden="true">●</span>
                    <span>
                      <strong className="text-white">Explainable Observations:</strong> Shows why an alert appears, data sufficiency, and what next step to take.
                    </span>
                  </li>
                </ul>

                {error && <Alert kind="error">{error}</Alert>}

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Button
                    type="button"
                    onClick={() => setStep('create-profile')}
                    disabled={busy}
                    className="rounded-xl px-6 py-3.5 text-base font-semibold shadow-lg shadow-cyan-500/20"
                  >
                    Get Started
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleExploreDemo()}
                    disabled={busy}
                    className="rounded-xl border-violet-500/50 bg-violet-950/60 px-5 py-3.5 text-base font-semibold text-violet-100 hover:bg-violet-900/70"
                  >
                    {busy ? 'Loading 90-Day Demo…' : 'Explore with a demo astronaut'}
                  </Button>

                  {realProfiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="px-2 py-2 text-sm font-medium text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
                    >
                      Return to Overview →
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-400">
                  <strong className="text-violet-300">Demo Mode Note:</strong> Selecting{' '}
                  <em>Explore with a demo astronaut</em> opens an isolated 90-day{' '}
                  <span className="font-mono text-violet-200">SYNTHETIC</span> profile (
                  <span className="font-mono text-slate-300">Cmdr. Alex Rivera</span>) and never modifies personal records.
                </p>
              </div>

              {/* Aerospace Biotelemetry Hero Visual (Section 8.2) */}
              <div className="relative overflow-hidden rounded-3xl border border-cyan-800/50 bg-slate-950/80 p-5 shadow-2xl sm:p-7 lg:col-span-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.16),transparent_58%)]"
                />
                {/* Orbital grid & spacecraft viewport header */}
                <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="font-mono font-semibold uppercase tracking-wider text-cyan-200">
                      ORBITAL BIOTELEMETRY BAY · MODULE H-01
                    </span>
                  </div>
                  <span className="rounded-full border border-violet-500/40 bg-violet-950/70 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-violet-200">
                    90-DAY TIMELINE READY
                  </span>
                </div>

                <div className="relative z-10 grid items-center gap-5 sm:grid-cols-12">
                  {/* Anatomical Biotelemetry Scanner */}
                  <div className="relative flex flex-col items-center justify-center rounded-2xl border border-cyan-900/60 bg-slate-900/65 p-4 sm:col-span-6">
                    <BodyFigure
                      selected={null}
                      interactive={false}
                      calmGlow
                      className="mx-auto max-w-[13.5rem]"
                    />
                    <div className="mt-2 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                        Multi-System Crew Monitor
                      </p>
                      <p className="mt-0.5 text-xs text-slate-300">
                        Cardiovascular · Sleep · CBC &amp; CMP
                      </p>
                    </div>
                  </div>

                  {/* Spacecraft Telemetry Readout Cards */}
                  <div className="space-y-3 sm:col-span-6" aria-hidden="true">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>CARDIOVASCULAR &amp; VITALS</span>
                        <span className="font-mono text-emerald-300">INSTRUMENT</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-slate-200">Heart Rate &amp; BP</span>
                        <span className="font-mono text-base font-bold text-cyan-300">
                          68 bpm · 119/76
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Includes SpO2 (98%), Temp (36.8 °C), Resp Rate &amp; ARED activity
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>SLEEP &amp; CIRCADIAN</span>
                        <span className="font-mono text-amber-300">ACTIGRAPHY</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-slate-200">90-Day Sleep Shift</span>
                        <span className="font-mono text-base font-bold text-amber-300">
                          7.5 h → 5.4 h
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Flags &ge;20% baseline decrease with actionable crew guidance
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>EPISODIC BLOOD LABS</span>
                        <span className="font-mono text-cyan-300">OSD-569 / OSD-575</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium text-slate-200">6 Scheduled Draws</span>
                        <span className="font-mono text-base font-bold text-emerald-300">
                          24 Biomarkers
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Hemoglobin, WBC, Platelets, Glucose, Electrolytes, Renal &amp; Liver
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs text-slate-300">
                  <span>Zero external telemetry transmission · Offline-capable PWA</span>
                  <span className="font-mono text-cyan-300">SHA-256 Verified Local Storage</span>
                </div>
              </div>
            </section>

            {/* Quick 3-Step Mission Workflow Summary */}
            <section
              aria-label="How TUMI-HEALT works"
              className="grid gap-4 rounded-2xl border border-slate-800/90 bg-slate-900/45 p-5 sm:grid-cols-3 sm:p-6"
            >
              <div className="space-y-1.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                  01 · Immediate Overview
                </span>
                <h3 className="text-base font-semibold text-white">
                  Understand Status in One Screen
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  See available measurements, collection dates, 90-day baseline comparisons, and missing or outdated data without hunting through menus.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                  02 · Explainable Observations
                </span>
                <h3 className="text-base font-semibold text-white">
                  Know Why &amp; What to Do Next
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  Every observation explains the recorded value, comparison period, data sufficiency, trigger rule, and recommended next step.
                </p>
              </div>
              <div className="space-y-1.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                  03 · Fast Local Import &amp; Check-In
                </span>
                <h3 className="text-base font-semibold text-white">
                  Import Lab/Wearable Files or Log Symptoms
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  Auto-detect indicators from CSV, XML, or XLSX files while keeping subjective mood, fatigue, and symptoms clearly separated.
                </p>
              </div>
            </section>

            {/* The Team Behind TUMI-HEALT (Section 8.3 — Six Cards) */}
            <section
              aria-labelledby="team-section-heading"
              className="space-y-6 border-t border-slate-800/90 pt-10"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                    Mission Engineering &amp; Biomedical Design Roster
                  </p>
                  <h2
                    id="team-section-heading"
                    className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl"
                  >
                    The Team Behind TUMI-HEALT
                  </h2>
                </div>
                <p className="max-w-xl text-xs leading-relaxed text-slate-400">
                  Structured team member cards with editable placeholders for names, roles, avatars, and mission contributions.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {TEAM_MEMBERS.map((member) => (
                  <article
                    key={member.id}
                    data-testid="team-member-card"
                    className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/65 p-5 shadow-md transition hover:border-cyan-500/40"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={member.photo}
                          alt={member.namePlaceholder}
                          className="h-14 w-14 shrink-0 rounded-2xl border border-cyan-500/35 object-cover object-top shadow-inner"
                        />
                        <div className="min-w-0">
                          <span className="inline-block rounded-md border border-slate-700 bg-slate-950/90 px-2 py-0.5 font-mono text-[11px] font-medium text-cyan-300">
                            {member.focusTag}
                          </span>
                          <h3 className="mt-1 truncate text-base font-semibold text-white">
                            {member.namePlaceholder}
                          </h3>
                          <p className="text-xs font-medium text-slate-300">
                            {member.rolePlaceholder}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-300">
                        {member.contributionPlaceholder}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                      <span>TUMI-HEALT Mission Crew</span>
                      <span className="font-mono text-slate-300">{member.badgeCode}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {step === 'create-profile' && (
          <div className="mx-auto my-auto w-full max-w-xl space-y-6 py-6">
            <StepProgress
              steps={['Create Profile', 'Choose Start']}
              currentStep={0}
            />

            <div className="rounded-2xl border border-slate-800/90 bg-slate-950/85 p-6 shadow-xl sm:p-8">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Let&apos;s create your astronaut profile.
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Only basic details are needed to get started. Your personal records stay locally in this browser and are never mixed with synthetic demo data.
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
          <div className="mx-auto my-auto w-full max-w-4xl space-y-6 py-6">
            <StepProgress
              steps={['Create Profile', 'Choose Start']}
              currentStep={1}
            />

            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Welcome, {createdName || 'Astronaut'}. How would you like to start?
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                You can switch between your personal profile and the 90-day synthetic demonstration anytime.
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
                  <h3 className="text-xl font-semibold text-white">My Own Health Profile</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Start with your own profile and import your health measurements or complete a daily check-in.
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
                    Option B · 90-Day Synthetic Demo
                  </span>
                  <h3 className="text-xl font-semibold text-white">Explore a Demo</h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Explore TUMI-HEALT using a complete 90-day synthetic astronaut health timeline (cardiovascular vitals, sleep actigraphy, and 6 episodic CBC/CMP blood draws).
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

        <footer className="mt-12 border-t border-slate-800/80 pt-5 text-center text-xs text-slate-400">
          TUMI-HEALT · Local-First Astronaut Health Monitoring &amp; Scientific Reference System · Non-Diagnostic Decision Support
        </footer>
      </main>
    </div>
  );
}
