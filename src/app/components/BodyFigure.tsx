import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getRecords } from '@/services';
import type { HealthCategory } from '@/types';
import type { BodyRegionId } from './BodyRegionPanel';
import prototypeHtml from '../../../docs/design/body-figure-prototype.html?raw';
import './BodyFigure.css';

type BodyFigureProps = {
  selected: BodyRegionId | null;
  onSelect?: (region: BodyRegionId) => void;
  astronautId?: string;
  interactive?: boolean;
  calmGlow?: boolean;
  className?: string;
};

type BodySystem = {
  id: BodyRegionId;
  title: string;
  accessibleName: string;
  category?: HealthCategory;
  hotspot: { x: number; y: number };
  leader: string;
  label: { x: number; y: number; width: number };
};

const SYSTEMS: BodySystem[] = [
  {
    id: 'sleep',
    title: 'Sleep',
    accessibleName: 'Sleep and recovery',
    category: 'sleep',
    hotspot: { x: 320, y: 82 },
    leader: 'M334,82 L520,82 L520,70',
    label: { x: 520, y: 52, width: 108 },
  },
  {
    id: 'cardiovascular',
    title: 'Heart',
    accessibleName: 'Heart',
    category: 'cardiovascular',
    hotspot: { x: 334, y: 266 },
    leader: 'M350,266 L520,266',
    label: { x: 520, y: 244, width: 108 },
  },
  {
    id: 'blood',
    title: 'Blood',
    accessibleName: 'Blood',
    category: 'blood',
    hotspot: { x: 424, y: 336 },
    leader: 'M424,336 L520,336',
    label: { x: 520, y: 314, width: 108 },
  },
  {
    id: 'bones_muscles',
    title: 'Bones & muscles',
    accessibleName: 'Bones and muscles, educational only',
    hotspot: { x: 266, y: 570 },
    leader: 'M266,570 L132,570',
    label: { x: 12, y: 548, width: 120 },
  },
];

const CATEGORIES: HealthCategory[] = ['sleep', 'cardiovascular', 'blood'];
const SVG_GEOMETRY = extractFigureGeometry(prototypeHtml);

function extractFigureGeometry(html: string): string {
  const match = html.match(/<svg\b[^>]*id="fig"[^>]*>([\s\S]*?)<!-- hotspots -->/i);
  if (!match) {
    throw new Error('The body figure prototype is missing its expected SVG geometry.');
  }
  return match[1];
}

function isActivationKey(event: KeyboardEvent<SVGGElement>): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

export function BodyFigure({
  selected,
  onSelect,
  astronautId,
  interactive = true,
  calmGlow = false,
  className = '',
}: BodyFigureProps) {
  const [recordCounts, setRecordCounts] = useState<Record<HealthCategory, number> | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (!interactive) return;
    if (!astronautId) {
      setRecordCounts({ sleep: 0, cardiovascular: 0, blood: 0 });
      setStatusError(null);
      return;
    }

    let cancelled = false;
    setRecordCounts(null);
    setStatusError(null);
    void Promise.all(
      CATEGORIES.map(async (category) => ({
        category,
        records: await getRecords({ astronaut_id: astronautId, category }),
      })),
    ).then((results) => {
      if (cancelled) return;
      setRecordCounts({
        sleep: 0,
        cardiovascular: 0,
        blood: 0,
        ...Object.fromEntries(results.map(({ category, records }) => [category, records.length])),
      });
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setStatusError(cause instanceof Error ? cause.message : String(cause));
    });

    return () => {
      cancelled = true;
    };
  }, [astronautId, interactive]);

  function getStatus(system: BodySystem): string {
    if (!system.category) return 'Educational';
    if (statusError) return 'Unavailable';
    if (!recordCounts) return 'Loading…';
    const count = recordCounts[system.category];
    return count === 0 ? 'No data yet' : `${count} ${count === 1 ? 'record' : 'records'}`;
  }

  function activate(event: KeyboardEvent<SVGGElement>, region: BodyRegionId) {
    if (!isActivationKey(event)) return;
    event.preventDefault();
    onSelect?.(region);
  }

  return (
    <div className={`body-figure ${className}`}>
      <svg
        viewBox="0 0 640 900"
        role={interactive ? 'group' : 'img'}
        aria-label={
          interactive
            ? 'Interactive body map. Select a body area to see related information.'
            : 'Stylized anatomical illustration'
        }
        data-selected={selected ?? undefined}
        className={`body-figure-svg${calmGlow ? ' body-figure-svg-calm' : ''}`}
      >
        <g aria-hidden="true" dangerouslySetInnerHTML={{ __html: SVG_GEOMETRY }} />

        {interactive && (
          <>
            <g className="body-figure-leaders" aria-hidden="true" fill="none" strokeWidth="1.2">
              {SYSTEMS.map((system) => (
                <path
                  key={system.id}
                  d={system.leader}
                  className={selected === system.id ? 'is-selected' : undefined}
                  data-system={system.id}
                />
              ))}
            </g>

            <g className="body-figure-hotspots">
              {SYSTEMS.map((system) => (
                <g
                  key={system.id}
                  className="body-figure-hotspot"
                  data-system={system.id}
                  role="button"
                  tabIndex={0}
                  aria-label={system.accessibleName}
                  aria-pressed={selected === system.id}
                  onClick={() => onSelect?.(system.id)}
                  onKeyDown={(event) => activate(event, system.id)}
                >
                  <circle
                    className="hit-area"
                    cx={system.hotspot.x}
                    cy={system.hotspot.y}
                    r="54"
                  />
                  <circle className="focus-ring" cx={system.hotspot.x} cy={system.hotspot.y} r="25" />
                  <circle className="ring" cx={system.hotspot.x} cy={system.hotspot.y} r="16" />
                  <circle className="dot" cx={system.hotspot.x} cy={system.hotspot.y} r="6" />
                </g>
              ))}
            </g>

            <g className="body-figure-labels">
              {SYSTEMS.map((system) => {
                const status = getStatus(system);
                return (
                  <g
                    key={system.id}
                    className={`body-figure-label${selected === system.id ? ' is-selected' : ''}`}
                    data-system={system.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${system.accessibleName}. ${status}.`}
                    aria-pressed={selected === system.id}
                    onClick={() => onSelect?.(system.id)}
                    onKeyDown={(event) => activate(event, system.id)}
                  >
                    <rect
                      x={system.label.x}
                      y={system.label.y}
                      width={system.label.width}
                      height="44"
                      rx="10"
                    />
                    <text x={system.label.x + 14} y={system.label.y + 20}>
                      {system.title}
                    </text>
                    <text className="sub" x={system.label.x + 14} y={system.label.y + 36}>
                      {status}
                    </text>
                  </g>
                );
              })}
            </g>
          </>
        )}
      </svg>

      {interactive && (
        <div
          className="body-figure-mobile-labels"
          role="group"
          aria-label="Select a body system"
        >
          {SYSTEMS.map((system) => (
            <button
              key={system.id}
              type="button"
              data-system={system.id}
              aria-pressed={selected === system.id}
              onClick={() => onSelect?.(system.id)}
              className={`body-figure-mobile-label${selected === system.id ? ' is-selected' : ''}`}
            >
              <span>{system.title}</span>
              <span className="body-figure-mobile-status">{getStatus(system)}</span>
            </button>
          ))}
        </div>
      )}

      {interactive && statusError && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          Could not load body system record counts: {statusError}
        </p>
      )}
    </div>
  );
}
