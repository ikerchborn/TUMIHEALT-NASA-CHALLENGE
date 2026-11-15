import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { BodyRegionPanel, type BodyRegionId } from '../components/BodyRegionPanel';
import { Alert, Button, Card, PageHeader } from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import { useProfile } from '../context/ProfileContext';

const regions: Array<{ id: BodyRegionId; label: string; detail: string }> = [
  { id: 'sleep', label: 'Head', detail: 'Sleep and recovery' },
  { id: 'cardiovascular', label: 'Chest', detail: 'Heart rate and blood pressure' },
  { id: 'blood', label: 'Torso', detail: 'Blood biomarkers' },
  { id: 'bones_muscles', label: 'Bones and muscles', detail: 'Educational, not monitored' },
];

function isActivationKey(event: KeyboardEvent<SVGGElement>): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

export function BodyExplorerPage() {
  const { active, isDemoMode } = useProfile();
  const [selected, setSelected] = useState<BodyRegionId>('cardiovascular');
  const [reviewOpen, setReviewOpen] = useState(false);

  function activateRegion(event: KeyboardEvent<SVGGElement>, region: BodyRegionId) {
    if (!isActivationKey(event)) return;
    event.preventDefault();
    setSelected(region);
  }

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        eyebrow={isDemoMode ? 'DEMO DATA · 2D body map' : '2D body map'}
        title="Body Explorer"
        subtitle="Select a region to see which information is available from your imported records. This illustration does not represent live monitoring."
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/import"
              className="inline-flex min-h-11 items-center rounded-control bg-mission-accent-strong px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              + Import data
            </Link>
            <Button type="button" variant="ghost" onClick={() => setReviewOpen(true)}>
              Request medical review
            </Button>
          </div>
        }
      />

      <Alert kind="info">
        This educational 2D illustration is not a medical image. No licensed 3D model is installed, so this screen does not load procedural 3D geometry.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card title="Select a body region" subtitle="Each hotspot also appears in the keyboard-accessible region list.">
          <div className="mx-auto max-w-md rounded-panel border border-cyan-900/50 bg-[radial-gradient(ellipse_at_50%_35%,rgba(8,145,178,0.15),transparent_65%)] p-3 sm:p-5">
            <svg
              viewBox="0 0 360 560"
              role="group"
              aria-label="Interactive educational body diagram"
              className="mx-auto h-auto max-h-[34rem] w-full"
            >
              <defs>
                <linearGradient id="body-fill" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#164e63" stopOpacity=".82" />
                  <stop offset=".52" stopColor="#0f2438" stopOpacity=".92" />
                  <stop offset="1" stopColor="#1e3a5f" stopOpacity=".78" />
                </linearGradient>
                <radialGradient id="organ-glow">
                  <stop offset="0" stopColor="#67e8f9" stopOpacity=".38" />
                  <stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                d="M180 31c-35 0-58 24-58 58 0 25 13 43 29 53-4 12-17 19-38 24-26 7-43 25-48 53l-16 95c-3 17 7 28 20 28 10 0 17-7 20-19l19-76-9 90c-2 17 4 28 16 31l-8 126c-1 16 8 26 21 26 12 0 19-8 21-23l18-116 18 116c2 15 9 23 21 23 13 0 22-10 21-26l-8-126c12-3 18-14 16-31l-9-90 19 76c3 12 10 19 20 19 13 0 23-11 20-28l-16-95c-5-28-22-46-48-53-21-5-34-12-38-24 16-10 29-28 29-53 0-34-23-58-58-58Z"
                fill="url(#body-fill)"
                stroke="#67e8f9"
                strokeOpacity=".55"
                strokeWidth="2"
              />
              <path d="M180 148v239M135 175l-20 100m110-100 20 100M146 390l-7 128m55-128 7 128" fill="none" stroke="#bae6fd" strokeOpacity=".34" strokeWidth="2" />
              <ellipse cx="180" cy="248" rx="43" ry="33" fill="url(#organ-glow)" />
              <path d="M180 228c-10-14-26-5-22 8 3 10 22 21 22 21s19-11 22-21c4-13-12-22-22-8Z" fill="#22d3ee" fillOpacity=".46" stroke="#a5f3fc" strokeOpacity=".8" />
              <path d="M166 300c8-8 20-8 28 0v42h-28z" fill="#fb7185" fillOpacity=".3" stroke="#fda4af" strokeOpacity=".62" />
              <path d="M161 92h38" stroke="#c4b5fd" strokeOpacity=".6" strokeWidth="2" />

              <g
                role="button"
                tabIndex={0}
                aria-label="Head: sleep and recovery"
                aria-pressed={selected === 'sleep'}
                onClick={() => setSelected('sleep')}
                onFocus={() => setSelected('sleep')}
                onKeyDown={(event) => activateRegion(event, 'sleep')}
                className="cursor-pointer outline-none"
              >
                <ellipse cx="180" cy="82" rx="46" ry="54" fill={selected === 'sleep' ? '#a78bfa' : '#a78bfa'} fillOpacity={selected === 'sleep' ? '.22' : '.08'} stroke={selected === 'sleep' ? '#c4b5fd' : 'transparent'} strokeWidth="3" />
                <text x="180" y="86" textAnchor="middle" fill="#f5f3ff" fontSize="14">Sleep</text>
              </g>
              <g
                role="button"
                tabIndex={0}
                aria-label="Heart: chest region for the cardiovascular system"
                aria-pressed={selected === 'cardiovascular'}
                onClick={() => setSelected('cardiovascular')}
                onFocus={() => setSelected('cardiovascular')}
                onKeyDown={(event) => activateRegion(event, 'cardiovascular')}
                className="cursor-pointer outline-none"
              >
                <path d="M132 190q48-35 96 0l-5 72q-43 23-86 0z" fill="#22d3ee" fillOpacity={selected === 'cardiovascular' ? '.2' : '.07'} stroke={selected === 'cardiovascular' ? '#67e8f9' : 'transparent'} strokeWidth="3" />
                <text x="180" y="220" textAnchor="middle" fill="#ecfeff" fontSize="14">Heart</text>
              </g>
              <g
                role="button"
                tabIndex={0}
                aria-label="Torso: blood biomarkers"
                aria-pressed={selected === 'blood'}
                onClick={() => setSelected('blood')}
                onFocus={() => setSelected('blood')}
                onKeyDown={(event) => activateRegion(event, 'blood')}
                className="cursor-pointer outline-none"
              >
                <path d="M143 270q37 16 74 0l-4 91q-33 19-66 0z" fill="#fb7185" fillOpacity={selected === 'blood' ? '.19' : '.06'} stroke={selected === 'blood' ? '#fda4af' : 'transparent'} strokeWidth="3" />
                <text x="180" y="316" textAnchor="middle" fill="#fff1f2" fontSize="14">Blood</text>
              </g>
              <g
                role="button"
                tabIndex={0}
                aria-label="Bone & muscle: educational, not monitored"
                aria-pressed={selected === 'bones_muscles'}
                onClick={() => setSelected('bones_muscles')}
                onFocus={() => setSelected('bones_muscles')}
                onKeyDown={(event) => activateRegion(event, 'bones_muscles')}
                className="cursor-pointer outline-none"
              >
                <path d="M151 372h58l12 142q-13 12-27 4l-14-89-14 89q-14 8-27-4z" fill="#fbbf24" fillOpacity={selected === 'bones_muscles' ? '.19' : '.05'} stroke={selected === 'bones_muscles' ? '#fcd34d' : 'transparent'} strokeWidth="3" />
                <text x="180" y="435" textAnchor="middle" fill="#fffbeb" fontSize="14">Bone &amp; muscle</text>
              </g>
            </svg>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-white">Body regions</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Keyboard-accessible body regions">
              {regions.map((region) => (
                <li key={region.id}>
                  <button
                    type="button"
                    aria-pressed={selected === region.id}
                    onClick={() => setSelected(region.id)}
                    className={`w-full rounded-control border px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                      selected === region.id
                        ? 'border-cyan-500/60 bg-cyan-950/60 text-white'
                        : 'border-mission-border bg-mission-canvas text-slate-300 hover:bg-mission-surface-raised'
                    }`}
                  >
                    <span className="block font-medium">{region.label}</span>
                    <span className="mt-0.5 block text-slate-400">{region.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <BodyRegionPanel region={selected} astronautId={active?.astronaut_id} />
      </div>
      <MedicalReviewDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        profileId={active?.astronaut_id}
        isDemoMode={isDemoMode}
      />
    </div>
  );
}
