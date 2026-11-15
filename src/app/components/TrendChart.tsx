import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/types';
import type { DailyCheckIn } from '@/types';

export function TrendChart({
  points,
  unit,
  baselineMedian,
  baselineBand,
  symptomCheckIns = [],
}: {
  points: TrendPoint[];
  unit: string | null;
  baselineMedian?: number | null;
  baselineBand?: { from: number; to: number } | null;
  symptomCheckIns?: DailyCheckIn[];
}) {
  const missingCount = points.filter((p) => p.value === null).length;
  const numericCount = points.length - missingCount;

  const data = points.map((p) => ({
    t: Date.parse(p.timestamp),
    value: p.value,
  }));

  if (numericCount === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        No numeric values to plot{missingCount > 0 ? ` (${missingCount} missing value${missingCount === 1 ? '' : 's'} recorded)` : ''}.
      </p>
    );
  }

  return (
    <div role="region" aria-label="Historical indicator trend chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(value: number) => new Date(value).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
            stroke="#94a3b8"
            fontSize={12}
          />
          <YAxis stroke="#94a3b8" fontSize={12} unit={unit ? ` ${unit}` : ''} width={70} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            labelFormatter={(value) => new Date(Number(value)).toLocaleString('en-US')}
          />
          {baselineBand && (
            <ReferenceArea
              y1={baselineBand.from}
              y2={baselineBand.to}
              fill="#38bdf8"
              fillOpacity={0.1}
              ifOverflow="hidden"
            />
          )}
          {typeof baselineMedian === 'number' && (
            <ReferenceLine
              y={baselineMedian}
              stroke="#38bdf8"
              strokeDasharray="4 4"
              label={{ value: 'Baseline median', fill: '#38bdf8', fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          {symptomCheckIns
            .filter((checkIn) => checkIn.symptoms.length > 0)
            .map((checkIn) => (
              <ReferenceLine
                key={checkIn.id}
                x={new Date(`${checkIn.checkin_date}T12:00:00`).getTime()}
                stroke="#fbbf24"
                strokeDasharray="2 3"
                label={{ value: 'Check-in', fill: '#fbbf24', fontSize: 10, position: 'insideTopLeft' }}
              />
            ))}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22d3ee"
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3, fill: '#22d3ee' }}
          />
        </LineChart>
      </ResponsiveContainer>
      {missingCount > 0 && (
        <p className="mt-2 text-[11px] text-amber-300/90">
          Gap indicator: {missingCount} missing (null) measurement{missingCount === 1 ? '' : 's'} kept on the timeline as gaps (not converted to zero).
        </p>
      )}
    </div>
  );
}
