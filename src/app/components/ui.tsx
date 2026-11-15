import { useEffect, useId, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { DataOrigin } from '@/types';

export const inputClass =
  'w-full rounded-control border border-mission-border bg-mission-surface-raised px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-mission-accent focus:outline-none focus:ring-2 focus:ring-cyan-500/25';

export type IconName =
  | 'home'
  | 'check-in'
  | 'measurements'
  | 'trends'
  | 'body'
  | 'assistant'
  | 'guides'
  | 'research'
  | 'privacy'
  | 'more'
  | 'upload'
  | 'close';

const iconPaths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7',
  'check-in': 'M8 4h8M9 3h6v3H9zM6 5H4v16h16V5h-2M8 12l2.5 2.5L16 9',
  measurements: 'M5 5h14M5 12h14M5 19h14M2.5 5h.01M2.5 12h.01M2.5 19h.01',
  trends: 'm3 17 6-6 4 4 8-8M15 7h6v6',
  body: 'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 11l-2 4 3 2 1 5h4l1-5 3-2-2-4-4 2-4-2Z',
  assistant: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z',
  guides: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22zM4 5.5v14A2.5 2.5 0 0 1 6.5 17H20',
  research: 'M4 4v16M8 4h11a1 1 0 0 1 1 1v14H7a3 3 0 0 0-3 3M8 8h8M8 12h7',
  privacy: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11ZM9 12l2 2 4-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 20h16',
  close: 'm6 6 12 12M18 6 6 18',
};

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-panel border border-mission-border bg-mission-surface p-card shadow-panel backdrop-blur-sm sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm leading-relaxed text-slate-300">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  primaryAction,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  primaryAction?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-400">{eyebrow}</p>
        )}
        <h1 className="text-title font-semibold tracking-tight text-white sm:text-display">{title}</h1>
        {subtitle && <p className="mt-1.5 text-caption leading-relaxed text-slate-300">{subtitle}</p>}
      </div>
      {primaryAction && <div className="shrink-0">{primaryAction}</div>}
    </header>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  status,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  status?: HealthStatus;
}) {
  return (
    <div className="rounded-panel border border-mission-border bg-mission-surface p-4 shadow-panel sm:p-5">
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-mission-accent sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-slate-300">{unit}</span>}
      </p>
      {status && <StatusBadge status={status} className="mt-3" />}
      {hint && <p className="mt-2 text-sm leading-relaxed text-slate-400">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <StatTile label={label} value={value} hint={hint} />;
}

export type HealthStatus =
  | 'within-usual-range'
  | 'different-from-usual'
  | 'review-recommended'
  | 'not-enough-data';

const healthStatusMeta: Record<HealthStatus, { label: string; icon: IconName; className: string }> = {
  'within-usual-range': {
    label: 'Within your usual range',
    icon: 'check-in',
    className: 'border-cyan-700/70 bg-cyan-950/50 text-cyan-100',
  },
  'different-from-usual': {
    label: 'Different from your usual',
    icon: 'trends',
    className: 'border-amber-700/70 bg-amber-950/40 text-amber-100',
  },
  'review-recommended': {
    label: 'Review recommended',
    icon: 'assistant',
    className: 'border-rose-700/70 bg-rose-950/40 text-rose-100',
  },
  'not-enough-data': {
    label: 'Not enough data',
    icon: 'more',
    className: 'border-slate-600 bg-slate-900 text-slate-200',
  },
};

export function StatusBadge({
  status,
  className = '',
}: {
  status: HealthStatus;
  className?: string;
}) {
  const meta = healthStatusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-sm font-medium ${meta.className} ${className}`}>
      <Icon name={meta.icon} className="h-4 w-4 shrink-0" />
      {meta.label}
    </span>
  );
}

export function RangeTabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div aria-label={label} className="inline-flex flex-wrap gap-1 rounded-control border border-mission-border bg-mission-canvas p-1" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-control px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent ${
            value === option.value
              ? 'bg-mission-surface-raised text-white'
              : 'text-slate-300 hover:bg-mission-surface hover:text-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChartPanel({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <Card title={title} subtitle={summary} className="min-w-0">
      {children}
    </Card>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <section
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-xl flex-col border-l border-mission-border bg-mission-surface p-5 shadow-panel sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-mission-border pb-4">
          <h2 id={titleId} className="text-xl font-semibold text-white">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-control p-2 text-slate-300 hover:bg-mission-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-accent"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}

type Variant = 'primary' | 'ghost' | 'danger';
const variants: Record<Variant, string> = {
  primary:
    'bg-mission-accent-strong text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:bg-slate-800 disabled:text-slate-300',
  ghost:
    'border border-slate-700 text-slate-200 hover:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50',
  danger:
    'border border-rose-800/80 text-rose-300 hover:bg-rose-950/60 focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus:outline-none disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-200">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm leading-relaxed text-slate-400">{hint}</span>}
    </label>
  );
}

const originStyles: Record<DataOrigin, string> = {
  SPACEFLIGHT: 'border-indigo-700/80 bg-indigo-950/80 text-indigo-200',
  GROUND_ANALOG: 'border-amber-700/80 bg-amber-950/80 text-amber-200',
  SYNTHETIC: 'border-slate-600 bg-slate-800 text-slate-200',
};
const originLabels: Record<DataOrigin, string> = {
  SPACEFLIGHT: 'Spaceflight',
  GROUND_ANALOG: 'Ground Analog',
  SYNTHETIC: 'Synthetic',
};

/** Project rule: data origin must always remain visible. */
export function OriginBadge({ origin }: { origin: DataOrigin }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-medium ${originStyles[origin]}`}>
      {originLabels[origin]}
    </span>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info' | 'warn'; children: ReactNode }) {
  const styles = {
    error: 'border-rose-800/80 bg-rose-950/50 text-rose-100',
    success: 'border-emerald-800/80 bg-emerald-950/50 text-emerald-100',
    info: 'border-cyan-800/80 bg-cyan-950/50 text-cyan-100',
    warn: 'border-amber-800/80 bg-amber-950/50 text-amber-100',
  };
  const labels = {
    error: 'Error',
    success: 'Saved',
    info: 'Note',
    warn: 'Important',
  };
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles[kind]}`}>
      <span className="mr-2 font-semibold">{labels[kind]}:</span>
      {children}
    </div>
  );
}

export function DisclaimerBanner() {
  return (
    <div className="border-b border-amber-900/50 bg-amber-950/35 px-4 py-2 text-center text-xs text-amber-200">
      Educational and self-monitoring support tool. It does not issue medical diagnoses; contact the mission medical team if you have concerns.
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-mission-border bg-mission-canvas px-4 py-8 text-center text-base leading-relaxed text-slate-300">
      {children}
    </div>
  );
}

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/40 bg-violet-950/75 px-4 py-3 text-sm text-violet-100 sm:px-6"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="rounded-md border border-violet-400/50 bg-violet-500/25 px-2.5 py-1 text-sm font-bold tracking-wide text-violet-100">
          DEMO DATA
        </span>
        <span className="leading-relaxed">
          Synthetic example data only. Your personal records are untouched.
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onExit}
        className="border-violet-400/40 bg-violet-900/60 px-3 py-2 text-sm text-violet-100 hover:bg-violet-800/80"
      >
        Exit Demo
      </Button>
    </div>
  );
}

export function StepProgress({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <nav aria-label="Progress" className="mb-5 flex flex-wrap items-center gap-2">
      {steps.map((label, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;
        return (
          <div
            key={label}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
              active
                ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-200'
                : done
                  ? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-800 bg-slate-950/50 text-slate-400'
            }`}
          >
            <span className="font-bold">{done ? '✓' : stepNum}</span>
            <span>{label}</span>
          </div>
        );
      })}
    </nav>
  );
}

export function ProgressiveDisclosure({
  simple,
  spaceContext,
  scientificDetails,
}: {
  simple: string;
  spaceContext: string;
  scientificDetails?: ReactNode;
}) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Simple Explanation</p>
        <p className="mt-1 text-slate-100">{simple}</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-300">Why It Matters in Space</p>
        <p className="mt-1 text-slate-200">{spaceContext}</p>
      </div>
      {scientificDetails && (
        <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-200">
            Scientific Information & Technical Details
          </summary>
          <div className="mt-2.5 space-y-2 leading-relaxed text-slate-400">{scientificDetails}</div>
        </details>
      )}
    </div>
  );
}

export function TooltipTerm({ term, explanation }: { term: string; explanation: string }) {
  return (
    <span className="group relative inline-flex items-center gap-1 border-b border-dotted border-cyan-400/60 text-cyan-200 cursor-help">
      <span>{term}</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs font-normal leading-relaxed text-slate-200 shadow-xl opacity-0 transition group-hover:visible group-hover:opacity-100"
      >
        {explanation}
      </span>
    </span>
  );
}
