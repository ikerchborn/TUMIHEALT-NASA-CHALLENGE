import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  GUIDANCE_CATALOG,
  SCIENTIFIC_INDICATOR_CATALOG,
  computePersonalBaseline,
  getRecords,
} from '@/services';
import type { HealthCategory, PersonalBaselineResult } from '@/types';
import { useProfile } from '../context/ProfileContext';
import { Alert, Card, Field, PageHeader, inputClass } from '../components/ui';
import { SpaceHealthRisksPanel } from './HazardsPage';

const CATEGORY_INFO: Record<HealthCategory, { label: string; badge: string }> = {
  blood: { label: 'Blood', badge: 'border-rose-700/60 bg-rose-950/50 text-rose-200' },
  sleep: { label: 'Sleep', badge: 'border-violet-700/60 bg-violet-950/50 text-violet-200' },
  cardiovascular: { label: 'Heart', badge: 'border-cyan-700/60 bg-cyan-950/50 text-cyan-200' },
};

export function HealthGuidesPage() {
  const { active } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = searchParams.get('category') as HealthCategory | null;
  const activeTab = searchParams.get('tab') === 'risks' ? 'risks' : 'guides';

  const [categoryFilter, setCategoryFilter] = useState<'all' | HealthCategory>(
    initialCat === 'blood' || initialCat === 'sleep' || initialCat === 'cardiovascular' ? initialCat : 'all',
  );
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialCat) {
      return SCIENTIFIC_INDICATOR_CATALOG.find((i) => i.category === initialCat)?.indicator_id ?? 'hemoglobin';
    }
    return 'hemoglobin';
  });

  const [latestText, setLatestText] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<PersonalBaselineResult | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCIENTIFIC_INDICATOR_CATALOG.filter((item) => {
      const catOk = categoryFilter === 'all' || item.category === categoryFilter;
      const textOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.scientific_relevance.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [categoryFilter, query]);

  const current = useMemo(
    () =>
      filtered.find((item) => item.indicator_id === selectedId) ??
      filtered[0] ??
      SCIENTIFIC_INDICATOR_CATALOG[0],
    [filtered, selectedId],
  );

  useEffect(() => {
    if (!active || !current) {
      setLatestText(null);
      setBaseline(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [recs, base] = await Promise.all([
          getRecords({ astronaut_id: active.astronaut_id, category: current.category, indicator: current.indicator_id }),
          computePersonalBaseline({
            astronaut_id: active.astronaut_id,
            category: current.category,
            indicator: current.indicator_id,
          }),
        ]);
        if (cancelled) return;
        recs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const latest = recs[0];
        setLatestText(
          latest
            ? `${latest.value !== null ? `${latest.value} ${latest.unit}` : 'Missing value'} on ${latest.timestamp.slice(0, 10)}`
            : null,
        );
        setBaseline(base);
        setGuideError(null);
      } catch (error) {
        if (cancelled) return;
        setGuideError(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, current]);

  const categoryGuidance = useMemo(
    () => GUIDANCE_CATALOG.find((g) => g.category === current.category),
    [current.category],
  );
  const medicalGuidance = useMemo(
    () => GUIDANCE_CATALOG.find((g) => g.category === 'general' && g.guidance_id.includes('medical')) ?? GUIDANCE_CATALOG[0],
    [],
  );

  const catMeta = CATEGORY_INFO[current.category];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learn · Health Guides"
        title={activeTab === 'risks' ? 'Space Health Risks' : 'Health Guides'}
        subtitle={
          activeTab === 'risks'
            ? 'Learn about five spaceflight hazards and their possible connections to health.'
            : 'Start with a short explanation of each indicator. Open advanced information when you want more detail.'
        }
      />

      <div role="tablist" aria-label="Health learning topics" className="flex flex-wrap gap-2">
        <button
          id="health-guides-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'guides'}
          aria-controls="health-guides-panel"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            setSearchParams(next, { replace: true });
          }}
          className={`rounded-control border px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
            activeTab === 'guides'
              ? 'border-cyan-500/45 bg-cyan-950/65 text-cyan-100'
              : 'border-mission-border text-slate-300 hover:bg-mission-surface-raised'
          }`}
        >
          Health Guides
        </button>
        <button
          id="space-health-risks-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'risks'}
          aria-controls="space-health-risks-panel"
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set('tab', 'risks');
            setSearchParams(next, { replace: true });
          }}
          className={`rounded-control border px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
            activeTab === 'risks'
              ? 'border-cyan-500/45 bg-cyan-950/65 text-cyan-100'
              : 'border-mission-border text-slate-300 hover:bg-mission-surface-raised'
          }`}
        >
          Space Health Risks
        </button>
      </div>

      {activeTab === 'risks' ? (
        <div id="space-health-risks-panel" role="tabpanel" aria-labelledby="space-health-risks-tab">
          <SpaceHealthRisksPanel />
        </div>
      ) : (
        <div id="health-guides-panel" role="tabpanel" aria-labelledby="health-guides-tab" className="space-y-6">
          <Alert kind="info">
            These guides explain health indicators in everyday language. They are educational and do not replace mission medical guidance.
          </Alert>

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[240px] flex-1">
                <Field label="Search Health Indicators">
                  <input
                    type="search"
                    className={inputClass}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search e.g. hemoglobin, sleep, heart rate…"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'blood', 'sleep', 'cardiovascular'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={categoryFilter === cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-control border px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                      categoryFilter === cat
                        ? 'border-cyan-400 bg-cyan-950/60 text-cyan-100'
                        : 'border-mission-border bg-mission-canvas text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {cat === 'all' ? 'All Categories' : CATEGORY_INFO[cat].label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {guideError && <Alert kind="error">Could not load personal reading details: {guideError}</Alert>}

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="max-h-[680px] space-y-2.5 overflow-y-auto pr-1">
              {filtered.map((item) => {
                const isSelected = item.indicator_id === current.indicator_id;
                const meta = CATEGORY_INFO[item.category];
                return (
                  <button
                    key={item.indicator_id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(item.indicator_id)}
                    className={`w-full rounded-panel border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/35'
                        : 'border-mission-border bg-mission-surface hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{item.name}</span>
                      <span className={`rounded-pill border px-2.5 py-1 text-xs font-medium ${meta.badge}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-cyan-300">
                      {item.indicator_id} · {item.measurement_unit}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{item.definition}</p>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="rounded-panel border border-mission-border p-4 text-center text-sm text-slate-300">
                  No indicators match your search.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <Card
                title={current.name}
                subtitle={`Category: ${catMeta.label} · Standard unit: ${current.measurement_unit} · Identifier: ${current.indicator_id}`}
              >
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border border-cyan-500/40 bg-cyan-950/60 px-2.5 py-1 font-semibold text-cyan-200">
                    Type: {(current.information_type ?? 'laboratory_result').replaceAll('_', ' ')}
                  </span>
                  <span className="rounded-md border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 font-semibold text-emerald-200">
                    {current.supports_trend_analysis !== false
                      ? 'Supports 90-Day Personal Baseline & Trend Analysis'
                      : 'Point-in-time reference'}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white">In simple terms</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-200">{current.definition}</p>
                <h3 className="mt-5 text-base font-semibold text-white">Why it matters</h3>
                <p className="mt-2 text-base leading-relaxed text-slate-200">{current.scientific_relevance}</p>
                <p className="mt-3 text-sm text-slate-300">
                  Standard unit: <code className="text-cyan-200">{current.measurement_unit}</code>
                </p>
                <details className="mt-5 rounded-control border border-mission-border bg-mission-canvas/60 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent">
                    Advanced information: how it is measured, space factors, sources and limitations
                  </summary>
                  <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
                    <div>
                      <h4 className="font-semibold text-white">What it measures</h4>
                      <p className="mt-1">{current.physiological_context}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">How it is measured</h4>
                      <p className="mt-1">{current.measurement_method}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Factors that may influence it</h4>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {current.potential_influencing_factors.map((factor) => <li key={factor}>{factor}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">Sources and limitations</h4>
                      <p className="mt-1"><strong>Sources:</strong> {current.data_source.join(', ')}</p>
                      <p className="mt-1"><strong>Limitations:</strong> {current.limitations.join(' ')}</p>
                      {current.evidence_reference.length > 0 && (
                        <p className="mt-1"><strong>References:</strong> {current.evidence_reference.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </details>
              </Card>

              <Card title="Your imported data" subtitle="Personal readings are shown only for the selected profile.">
                {!active ? (
                  <p className="text-sm text-slate-300">
                    Select or create a profile to see personal readings.{' '}
                    <Link to="/profiles" className="text-cyan-200 underline">Manage profiles</Link>
                  </p>
                ) : !latestText ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">No personal measurements found for this indicator.</p>
                    <Link to="/import" className="inline-flex rounded-control bg-mission-accent-strong px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500">
                      Import data
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 text-base text-slate-200">
                    <p><strong>Latest reading:</strong> {latestText}</p>
                    {baseline?.status === 'computed' ? (
                      <p>
                        <strong>Your usual pattern:</strong> median {baseline.median?.toFixed(2)} {baseline.unit} across {baseline.valid_count} samples.
                      </p>
                    ) : (
                      <p className="text-amber-200">
                        Not enough data to calculate a usual pattern yet. At least 3 valid samples in matching units are needed.
                      </p>
                    )}
                    {categoryGuidance && (
                      <p className="text-sm leading-relaxed text-slate-300">
                        {categoryGuidance.content}{' '}
                        <a
                          href={categoryGuidance.scientific_reference}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200 underline"
                        >
                          Guidance source
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </Card>

              <Alert kind="warn">
                <strong>When to contact the medical team:</strong>{' '}
                {medicalGuidance?.content ??
                  'Contact the mission medical team whenever you feel unusual symptoms, notice repeated unexpected changes from your usual pattern, or want support interpreting a reading.'}
              </Alert>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
