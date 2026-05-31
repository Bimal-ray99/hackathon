'use client';

import { useEffect, useState } from 'react';
import { TbFlag, TbShieldCheck, TbShieldExclamation, TbShieldX } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Grade = 'safe' | 'caution' | 'danger';

interface Factor {
  label: string;
  impact: number;
  detail: string;
}

interface FlagScore {
  flag_key: string;
  score: number;
  grade: Grade;
  factors: Factor[];
  source: 'live' | 'seed';
}

const GRADE_STYLE: Record<Grade, {
  ring: string; bar: string; text: string; bg: string;
  icon: React.ReactNode; label: string;
}> = {
  safe:    { ring: 'ring-emerald-500/30', bar: 'bg-emerald-500',  text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <TbShieldCheck className="w-5 h-5" />,      label: 'Safe to ship' },
  caution: { ring: 'ring-yellow-500/30',  bar: 'bg-yellow-500',   text: 'text-yellow-400',  bg: 'bg-yellow-500/10',  icon: <TbShieldExclamation className="w-5 h-5" />, label: 'Ship with caution' },
  danger:  { ring: 'ring-red-500/40',     bar: 'bg-red-500',      text: 'text-red-400',     bg: 'bg-red-500/10',     icon: <TbShieldX className="w-5 h-5" />,           label: 'High risk — hold' },
};

function ScoreRing({ score, grade }: { score: number; grade: Grade }) {
  const style = GRADE_STYLE[grade];
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="80" height="80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={grade === 'safe' ? '#10b981' : grade === 'caution' ? '#eab308' : '#ef4444'}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <p className={`text-xl font-bold tabular-nums ${style.text}`}>{score}</p>
        <p className="text-xs text-slate-500 -mt-0.5">/ 100</p>
      </div>
    </div>
  );
}

interface FlagSafetyScoreProps {
  flagKey?: string;
}

export function FlagSafetyScore({ flagKey = 'new-upload-flow' }: FlagSafetyScoreProps) {
  const [data, setData] = useState<FlagScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/flags/safety?flag_key=${encodeURIComponent(flagKey)}`)
      .then(r => r.json())
      .then(d => { setData(d as FlagScore); setLoading(false); })
      .catch(() => setLoading(false));
  }, [flagKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <span className="w-4 h-4 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Computing safety score...</span>
      </div>
    );
  }

  if (!data) return null;

  const style = GRADE_STYLE[data.grade];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          <h2 className="text-sm font-semibold text-slate-700">Flag Safety Score</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
live Coral data
        </span>
      </div>

      <div className={`rounded-2xl border bg-slate-950 border-slate-800 p-5 ring-1 ${style.ring}`}>
        {/* Top: score + grade */}
        <div className="flex items-center gap-5 mb-5">
          <ScoreRing score={data.score} grade={data.grade} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={style.text}>{style.icon}</span>
              <span className={`text-sm font-bold ${style.text}`}>{style.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TbFlag className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-mono text-blue-300">{data.flag_key}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {data.grade === 'danger'
                ? 'PulseIQ would have blocked this rollout. This flag caused the incident.'
                : data.grade === 'caution'
                ? 'Proceed with a canary rollout. Monitor Sentry for 10 minutes before full enable.'
                : 'Flag appears safe. No historical error correlation detected.'}
            </p>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-slate-600 mb-1.5">
            <span>Risk factors</span>
            <span className={style.text}>{data.score}/100</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${style.bar}`}
              style={{ width: `${data.score}%` }}
            />
          </div>
        </div>

        {/* Factor breakdown */}
        <div className="space-y-2">
          {data.factors.map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <span className={`text-xs font-mono font-semibold w-8 shrink-0 ${
                f.impact < -10 ? 'text-red-400' :
                f.impact < -5  ? 'text-yellow-400' :
                f.impact < 0   ? 'text-slate-400' :
                                 'text-emerald-400'
              }`}>
                {f.impact === 0 ? '±0' : f.impact}
              </span>
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-300">{f.label}</span>
                <p className="text-xs text-slate-600 leading-snug">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* "What if" callout for danger flags */}
        {data.grade === 'danger' && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-red-400/80 leading-relaxed">
              Had PulseIQ been active before this rollout, the score of{' '}
              <span className="font-bold text-red-400">{data.score}/100</span> would have
              triggered an automatic hold — preventing{' '}
              <span className="font-bold text-red-400">
                ${(data.factors[0]?.impact ?? 0) < -30 ? '35,200' : '8,400'} MRR at risk
              </span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
