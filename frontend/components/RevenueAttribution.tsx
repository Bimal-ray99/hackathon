'use client';

import { useEffect, useState } from 'react';
import { SiGithub } from 'react-icons/si';
import { TbTrendingUp, TbTrendingDown, TbMinus } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CommitRevenue {
  sha: string;
  message: string;
  author: string;
  date: string;
  flag: string | null;
  features: string[];
  mrr_delta: number;
  arr_impact: number;
  customers_affected: number;
  status: 'positive' | 'incident' | 'neutral';
}

interface EngineerArr {
  author: string;
  arr: number;
}

interface RevenueData {
  commits: CommitRevenue[];
  engineer_arr: EngineerArr[];
  total_positive_arr: number;
  live: boolean;
}

function formatArr(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function RevenueAttribution() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/revenue/commits`)
      .then(r => r.json())
      .then((d: RevenueData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <span className="w-4 h-4 border-2 border-slate-600 border-t-emerald-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Joining GitHub × Stripe via Coral...</span>
      </div>
    );
  }

  if (!data) return null;

  const maxArr = Math.max(...data.commits.map(c => Math.abs(c.arr_impact)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-700">Revenue Attribution by Commit</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">GitHub × Stripe via Coral</span>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
          <p className="text-xs text-slate-500 mb-1">Positive ARR shipped</p>
          <p className="text-lg font-bold text-emerald-400 tabular-nums">{formatArr(data.total_positive_arr)}</p>
        </div>
        {data.engineer_arr.slice(0, 2).map(e => (
          <div key={e.author} className="rounded-xl bg-slate-950 border border-slate-800 p-3">
            <p className="text-xs text-slate-500 mb-1 font-mono">{e.author}</p>
            <p className="text-lg font-bold text-blue-400 tabular-nums">{formatArr(e.arr)}</p>
          </div>
        ))}
      </div>

      {/* Commit table */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 text-xs">
          <div className="contents text-slate-600 font-medium uppercase tracking-wider">
            <div className="px-4 py-2 border-b border-slate-800">Commit</div>
            <div className="px-3 py-2 border-b border-slate-800">Message</div>
            <div className="px-3 py-2 border-b border-slate-800 text-right">MRR Δ</div>
            <div className="px-4 py-2 border-b border-slate-800 text-right">ARR</div>
          </div>

          {data.commits.map((c, i) => {
            const isLast = i === data.commits.length - 1;
            const borderClass = isLast ? '' : 'border-b border-slate-800/60';
            const barWidth = maxArr > 0 ? (Math.abs(c.arr_impact) / maxArr) * 100 : 0;
            return (
              <div key={c.sha} className="contents group">
                <div className={`px-4 py-3 ${borderClass} flex items-center gap-2`}>
                  <SiGithub className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="font-mono text-slate-400">{c.sha}</span>
                </div>
                <div className={`px-3 py-3 ${borderClass} min-w-0`}>
                  <p className="text-slate-300 truncate">{c.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-600 font-mono">{c.author}</span>
                    {c.flag && (
                      <span className="text-blue-500 font-mono text-xs">#{c.flag}</span>
                    )}
                    {/* Impact bar */}
                    <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden max-w-20">
                      <div
                        className={`h-full rounded-full ${
                          c.status === 'incident' ? 'bg-red-500' :
                          c.status === 'positive' ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        style={{ width: `${barWidth}%`, transition: 'width 0.7s ease' }}
                      />
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-3 ${borderClass} text-right flex items-center justify-end gap-1`}>
                  {c.mrr_delta > 0 ? (
                    <TbTrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : c.mrr_delta < 0 ? (
                    <TbTrendingDown className="w-3 h-3 text-red-500" />
                  ) : (
                    <TbMinus className="w-3 h-3 text-slate-600" />
                  )}
                  <span className={`font-mono font-semibold ${
                    c.mrr_delta > 0 ? 'text-emerald-400' :
                    c.mrr_delta < 0 ? 'text-red-400' : 'text-slate-600'
                  }`}>
                    {c.mrr_delta === 0 ? '—' : (c.mrr_delta > 0 ? '+' : '') + formatArr(c.mrr_delta)}
                  </span>
                </div>
                <div className={`px-4 py-3 ${borderClass} text-right`}>
                  <span className={`font-mono font-bold text-sm ${
                    c.arr_impact > 0 ? 'text-emerald-400' :
                    c.arr_impact < 0 ? 'text-red-400' : 'text-slate-600'
                  }`}>
                    {c.arr_impact === 0 ? '—' : (c.arr_impact > 0 ? '+' : '') + formatArr(c.arr_impact)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500 text-right">
        github.commits JOIN stripe.subscriptions ON customer_id — powered by Coral
      </p>
    </div>
  );
}
