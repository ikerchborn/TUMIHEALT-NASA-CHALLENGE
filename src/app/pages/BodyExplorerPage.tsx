import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BodyRegionPanel, type BodyRegionId } from '../components/BodyRegionPanel';
import { BodyFigure } from '../components/BodyFigure';
import { Alert, Button, Card, PageHeader } from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import { useProfile } from '../context/ProfileContext';

const regions: Array<{ id: BodyRegionId; label: string; detail: string }> = [
  { id: 'sleep', label: 'Sleep', detail: 'Brain and recovery' },
  { id: 'cardiovascular', label: 'Heart', detail: 'Heart rate and blood pressure' },
  { id: 'blood', label: 'Blood', detail: 'Blood biomarkers' },
  { id: 'bones_muscles', label: 'Bones and muscles', detail: 'Educational, not monitored' },
];

export function BodyExplorerPage() {
  const { active, isDemoMode } = useProfile();
  const [selected, setSelected] = useState<BodyRegionId | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

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
        This stylized anatomical illustration is for orientation only and does not represent live monitoring.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card title="Select a body region" subtitle="Each hotspot also appears in the keyboard-accessible region list.">
          <div className="mx-auto max-w-[640px] rounded-panel border border-cyan-900/50 bg-[radial-gradient(ellipse_at_50%_35%,rgba(8,145,178,0.15),transparent_65%)] p-3 sm:p-5">
            <BodyFigure
              selected={selected}
              onSelect={setSelected}
              astronautId={active?.astronaut_id}
              interactive
            />
          </div>

          <p className="mt-3 text-sm text-slate-400">Dots are body areas you can select.</p>

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

        {selected ? (
          <BodyRegionPanel region={selected} astronautId={active?.astronaut_id} />
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Select a body system</h2>
              <p className="mt-2 text-sm text-slate-400">
                Choose a dot, label, or body region to see related information.
              </p>
            </div>
          </div>
        )}
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
