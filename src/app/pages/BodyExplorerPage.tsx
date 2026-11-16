import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRecords, type ClinicalSeverity } from '@/services';
import type { HealthRecord } from '@/types';
import { BodyRegionPanel, type BodyRegionId } from '../components/BodyRegionPanel';
import { BodyFigure } from '../components/BodyFigure';
import {
  MissionBodyStatusSummary,
  buildBodySystemSummaries,
} from '../components/MissionBodyStatusSummary';
import { Alert, Button, Card, PageHeader } from '../components/ui';
import { MedicalReviewDrawer } from '../components/MedicalReviewDrawer';
import { useProfile } from '../context/ProfileContext';

const regions: Array<{ id: BodyRegionId; label: string; detail: string }> = [
  { id: 'sleep', label: 'Sleep', detail: 'Brain and recovery' },
  { id: 'cardiovascular', label: 'Heart', detail: 'Heart rate and blood pressure' },
  { id: 'blood', label: 'Blood', detail: 'Blood biomarkers' },
  { id: 'bones_muscles', label: 'Bones and muscles', detail: 'Educational, not monitored' },
];

function severityDotClass(severity: ClinicalSeverity | 'educational'): string {
  switch (severity) {
    case 'nominal':
      return 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]';
    case 'attention':
      return 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]';
    case 'alert':
      return 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.85)]';
    case 'educational':
    case 'insufficient':
    default:
      return 'bg-cyan-400/80';
  }
}

export function BodyExplorerPage() {
  const { active, isDemoMode } = useProfile();
  const [selected, setSelected] = useState<BodyRegionId | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active?.astronaut_id) {
      setRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getRecords({ astronaut_id: active.astronaut_id })
      .then((recs) => {
        if (!cancelled) setRecords(recs);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active?.astronaut_id]);

  const { severities } = useMemo(
    () => buildBodySystemSummaries(records, active?.astronaut_id),
    [records, active?.astronaut_id],
  );

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
              systemSeverities={severities}
              interactive
            />
          </div>

          <p className="mt-3 text-sm text-slate-400">
            Dots are color-coded by clinical severity (Amber: attention, Green: nominal, Cyan: educational).
          </p>

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
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden="true"
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${severityDotClass(severities[region.id])}`}
                      />
                      {region.label}
                    </span>
                    <span className="mt-0.5 block text-slate-400">{region.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {selected ? (
          <BodyRegionPanel
            region={selected}
            astronautId={active?.astronaut_id}
            onBackToSummary={() => setSelected(null)}
          />
        ) : (
          <MissionBodyStatusSummary
            records={records}
            astronautId={active?.astronaut_id}
            loading={loading}
            onSelectRegion={setSelected}
          />
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
