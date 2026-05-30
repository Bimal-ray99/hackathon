'use client';

import { useState, useEffect } from 'react';
import { TbLoader2, TbShield, TbShieldCheck, TbShieldX } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface OracleReason {
  signal: string;
  detail: string;
  weight: number;
}

interface OracleResult {
  flag_key: string;
  score: number | null;
  recommendation: 'DEPLOY' | 'WAIT' | 'ABORT' | null;
  reasons: OracleReason[];
  source: 'live' | 'seed';
  error?: string;
}

interface OraclePanelProps {
  flagKey: string;
  seed?: boolean;
}

const REC_STYLE = {
  DEPLOY: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: TbShieldCheck, stroke: '#10b981' },
  WAIT:   { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500/30',   icon: TbShield,      stroke: '#f59e0b' },
  ABORT:  { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     icon: TbShieldX,     stroke: '#ef4444' },
};

export function OraclePanel({ flagKey, seed = true }: OraclePanelProps) {
  const [result, setResult] = useState<OracleResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/oracle?flag_key=${encodeURIComponent(flagKey)}&seed=${seed}`)
      .then(r => r.json())
      .then(data => { setResult(data as OracleResult); setLoading(false); })
      .catch(() => setLoading(false));
  }, [flagKey, seed]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-slate-400">
        <TbLoader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Checking deploy safety via Coral...</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.error || result.score === null || result.recommendation === null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Pre-Deploy Oracle</h2>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center">
          <p className="text-xs text-slate-500">No live data — connect Coral to see real-time deploy risk scores</p>
        </div>
      </div>
    );
  }

  const style = REC_STYLE[result.recommendation];
  const Icon = style.icon;
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (result.score / 100) * circumference;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">Pre-Deploy Oracle</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">{result.source === 'live' ? 'live Coral' : 'seed data'}</span>
      </div>

      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5">
        <div className="flex items-center gap-6 pb-4 border-b border-slate-800 mb-4">
          <div className="relative shrink-0">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
              <circle
                cx="28" cy="28" r={r} fill="none"
                stroke={style.stroke}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${style.text}`}>
              {result.score}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 mb-1.5">
              Deploy risk for <span className="font-mono text-slate-300">{result.flag_key}</span>
            </p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold ${style.bg} ${style.text} ${style.border}`}>
              <Icon className="w-4 h-4" />
              {result.recommendation}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk signals</p>
          {result.reasons.map((reason, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.bg} ${style.text} ${style.border}`}>
                +{reason.weight}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-300">{reason.signal}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{reason.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
