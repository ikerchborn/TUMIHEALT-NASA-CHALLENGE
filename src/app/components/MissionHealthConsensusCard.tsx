import {
  MISSION_ENVIRONMENTS,
  type MissionEnvironment,
  type MultiSystemConsensusResult,
} from '@/services';
import { clinicalSeverityToHealthStatus, severityBorderClass, StatusBadge } from './ui';

interface MissionHealthConsensusCardProps {
  environment: MissionEnvironment;
  onEnvironmentChange: (env: MissionEnvironment) => void;
  consensus: MultiSystemConsensusResult;
}

export function MissionHealthConsensusCard({
  environment,
  onEnvironmentChange,
  consensus,
}: MissionHealthConsensusCardProps) {
  const healthStatus = clinicalSeverityToHealthStatus(consensus.overallSeverity);
  const borderClass = severityBorderClass(healthStatus);

  const panelBgClass =
    consensus.overallSeverity === 'alert'
      ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/30'
      : consensus.overallSeverity === 'attention'
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/25'
        : consensus.overallSeverity === 'nominal'
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/25'
          : 'bg-slate-900/90';

  return (
    <section
      aria-labelledby="mission-consensus-title"
      className={`rounded-2xl border-2 ${borderClass} ${panelBgClass} p-5 shadow-panel sm:p-6`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              Multi-System Clinical Consensus
            </p>
            <StatusBadge
              status={healthStatus}
              label={consensus.overallBadgeLabel}
            />
          </div>
          <h2
            id="mission-consensus-title"
            className="text-xl font-semibold text-white sm:text-2xl"
          >
            Mission Health Consensus
          </h2>
          <p className="text-xs text-slate-300">
            {consensus.environmentRiskNote}
          </p>
        </div>

        {/* Mission Environment Selector */}
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Mission Environment
          </span>
          <div
            role="group"
            aria-label="Mission Environment Selector"
            className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-700/80 bg-slate-950/80 p-1"
          >
            {MISSION_ENVIRONMENTS.map((opt) => {
              const active = opt.id === environment;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onEnvironmentChange(opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Synthesized Diagnosis */}
      <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/75 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Synthesized Multi-System Assessment
        </p>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-white sm:text-base">
          {consensus.synthesizedDiagnosis}
        </p>
      </div>

      {/* Triage & Escalation Protocol */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-cyan-800/60 bg-cyan-950/25 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            1. Immediate Crew Self-Action
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-200">
            {consensus.immediateCrewSelfAction}
          </p>
        </div>

        <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            2. Mission Routine Prompt
          </p>
          <ol className="mt-2 space-y-1 text-xs leading-relaxed text-slate-200">
            {consensus.missionRoutinePrompt.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-rose-700/60 bg-rose-950/25 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
            3. Ground Control / Flight Surgeon Trigger
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-200">
            {consensus.flightSurgeonTrigger}
          </p>
        </div>
      </div>
    </section>
  );
}
