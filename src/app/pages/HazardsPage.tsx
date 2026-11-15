import { useMemo, useState } from 'react';
import { getRecords, listAllHazards } from '@/services';
import type { HazardId, SpaceHazard } from '@/types';
import { useProfile } from '../context/ProfileContext';
import { useAsync } from '../hooks/useAsync';
import { Alert, Card, ProgressiveDisclosure } from '../components/ui';

type Strength = SpaceHazard['evidence_strength'];

const hazardMeta: Record<
  HazardId,
  {
    title: string;
    shortTag: string;
    simpleStory: string;
    astronautImpact: string;
    categories: string[];
    accent: string;
  }
> = {
  space_radiation: {
    title: '1. Radiation',
    shortTag: 'Cosmic & Solar Particles',
    simpleStory:
      'Outside Earth’s protective atmosphere and magnetic field, astronauts are exposed to higher levels of space radiation.',
    astronautImpact:
      'Over long missions, radiation can stress blood-forming cells, immune cells, and DNA repair processes.',
    categories: ['Blood Health (WBC, RBC, Platelets)'],
    accent: 'border-rose-500/30',
  },
  isolation_confinement: {
    title: '2. Isolation and Confinement',
    shortTag: 'Small Crew & Enclosed Quarters',
    simpleStory:
      'Living and working in a small spacecraft for months limits privacy, social variety, and natural day-night cues.',
    astronautImpact:
      'Isolation and shifted light schedules can disrupt circadian rhythm, sleep duration, and recovery quality.',
    categories: ['Sleep and Recovery'],
    accent: 'border-violet-500/30',
  },
  distance_from_earth: {
    title: '3. Distance from Earth',
    shortTag: 'Communication Delay & Autonomy',
    simpleStory:
      'As missions travel farther from Earth, communication delays grow and rapid medical evacuation is not possible.',
    astronautImpact:
      'Crews need clear self-monitoring tools to track trends early and know when to consult mission medical support.',
    categories: ['Blood', 'Sleep', 'Heart & Check-in'],
    accent: 'border-amber-500/30',
  },
  gravity_fields: {
    title: '4. Gravity Fields',
    shortTag: 'Microgravity, Moon & Mars Transitions',
    simpleStory:
      'Moving between Earth gravity, weightlessness, and lunar or Martian gravity changes how fluids and muscles behave.',
    astronautImpact:
      'Fluids shift toward the upper body, plasma volume can drop, and heart rate/blood pressure must adapt when gravity returns.',
    categories: ['Heart and Circulation', 'Blood Health'],
    accent: 'border-cyan-500/30',
  },
  hostile_closed_environments: {
    title: '5. Hostile and Closed Environments',
    shortTag: 'Recycled Air, Water & Cabin Stressors',
    simpleStory:
      'A spacecraft is a sealed habitat where air, water, temperature, CO2, and noise must be continuously managed.',
    astronautImpact:
      'Combined environmental stressors can affect sleep continuity, immune markers, hydration, and daily performance.',
    categories: ['Sleep and Recovery', 'Blood Health'],
    accent: 'border-emerald-500/30',
  },
};

function HazardIllustration({ hazardId }: { hazardId: HazardId }) {
  if (hazardId === 'space_radiation') {
    return (
      <svg viewBox="0 0 120 90" className="h-24 w-32 shrink-0" role="img" aria-label="Space radiation illustration">
        <rect width="120" height="90" rx="14" fill="#091122" stroke="#1e293b" />
        <circle cx="60" cy="45" r="18" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="2" />
        <path d="M15 20 L45 38 M10 55 L42 47 M105 25 L76 40 M105 68 L75 52" stroke="#fb7185" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="60" cy="45" r="5" fill="#fda4af" />
      </svg>
    );
  }
  if (hazardId === 'isolation_confinement') {
    return (
      <svg viewBox="0 0 120 90" className="h-24 w-32 shrink-0" role="img" aria-label="Isolation and confinement illustration">
        <rect width="120" height="90" rx="14" fill="#091122" stroke="#1e293b" />
        <rect x="26" y="20" width="68" height="50" rx="10" fill="#17153b" stroke="#8b5cf6" strokeWidth="2" />
        <circle cx="52" cy="45" r="8" fill="#a78bfa" />
        <path d="M74 34 A10 10 0 1 0 82 52 A8 8 0 1 1 74 34 Z" fill="#ddd6fe" />
      </svg>
    );
  }
  if (hazardId === 'distance_from_earth') {
    return (
      <svg viewBox="0 0 120 90" className="h-24 w-32 shrink-0" role="img" aria-label="Distance from Earth illustration">
        <rect width="120" height="90" rx="14" fill="#091122" stroke="#1e293b" />
        <circle cx="28" cy="54" r="14" fill="#0369a1" stroke="#38bdf8" strokeWidth="2" />
        <circle cx="94" cy="30" r="8" fill="#92400e" stroke="#fbbf24" strokeWidth="2" />
        <path d="M42 48 Q68 38 86 33" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    );
  }
  if (hazardId === 'gravity_fields') {
    return (
      <svg viewBox="0 0 120 90" className="h-24 w-32 shrink-0" role="img" aria-label="Gravity fields illustration">
        <rect width="120" height="90" rx="14" fill="#091122" stroke="#1e293b" />
        <circle cx="60" cy="34" r="14" fill="#083344" stroke="#22d3ee" strokeWidth="2" />
        <path d="M60 72 L60 52 M52 59 L60 51 L68 59" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-32 shrink-0" role="img" aria-label="Hostile closed environment illustration">
      <rect width="120" height="90" rx="14" fill="#091122" stroke="#1e293b" />
      <polygon points="60,16 98,34 98,62 60,78 22,62 22,34" fill="#052e2b" stroke="#34d399" strokeWidth="2" />
      <circle cx="60" cy="47" r="10" fill="#10b981" opacity="0.7" />
    </svg>
  );
}

const strengthLabels: Record<Strength, string> = {
  established: 'Established Evidence',
  moderate: 'Moderate Evidence',
  emerging: 'Emerging Evidence',
};

export function SpaceHealthRisksPanel() {
  const { active } = useProfile();
  const id = active?.astronaut_id;
  const hazards = useMemo(() => listAllHazards(), []);
  const [filter, setFilter] = useState<'all' | Strength>('all');

  const { data: counts } = useAsync(async () => {
    const map: Record<string, number> = {};
    if (!id) return map;
    for (const r of await getRecords({ astronaut_id: id })) {
      map[r.indicator] = (map[r.indicator] ?? 0) + 1;
    }
    return map;
  }, [id]);

  const visible = hazards.filter((h) => filter === 'all' || h.evidence_strength === filter);

  return (
    <div className="space-y-6">
      <Alert kind="info">
        TUMI-HEALT explains how spaceflight hazards relate to blood, sleep, and heart indicators. It does <strong>not</strong> directly measure radiation doses or cabin air quality.
      </Alert>

      <div className="flex flex-wrap gap-2">
        {(['all', 'established', 'moderate', 'emerging'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-control border px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
              filter === f
                ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                : 'border-mission-border bg-mission-canvas text-slate-300 hover:border-slate-500'
            }`}
          >
            {f === 'all' ? 'All 5 Hazards' : strengthLabels[f]}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {visible.map((h) => {
          const meta = hazardMeta[h.hazard_id];
          const recordedRelated = h.related_indicators.filter((ind) => (counts?.[ind] ?? 0) > 0).length;

          return (
            <Card
              key={h.hazard_id}
              className={meta.accent}
              title={meta.title}
              subtitle={meta.shortTag}
              action={
                <span className="rounded-pill border border-mission-border bg-mission-canvas px-3 py-1 text-sm text-slate-200">
                  {strengthLabels[h.evidence_strength]}
                </span>
              }
            >
              <div className="flex flex-col gap-5 sm:flex-row">
                <HazardIllustration hazardId={h.hazard_id} />
                <div className="flex-1 space-y-4">
                  <ProgressiveDisclosure
                    simple={meta.simpleStory}
                    spaceContext={`${meta.astronautImpact} Possible effects: ${h.potential_health_effects.join(', ')}.`}
                    scientificDetails={
                      <>
                        <p>
                          <strong>Backend hazard description:</strong> {h.description}
                        </p>
                        <p>
                          <strong>Related health categories:</strong> {meta.categories.join(', ')}
                        </p>
                        <p>
                          <strong>Tracked indicators linked to this hazard:</strong>{' '}
                          {h.related_indicators.join(', ')}
                          {active
                            ? ` (${recordedRelated}/${h.related_indicators.length} have personal measurements for ${active.display_name}).`
                            : '.'}
                        </p>
                        <p>
                          <strong>Limitation:</strong> Hazard relationships are educational; this software does not measure environmental radiation or cabin toxins directly.
                        </p>
                      </>
                    }
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
