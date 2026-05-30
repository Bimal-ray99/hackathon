'use client';

import { useState, useEffect } from 'react';
import { TbLoader2, TbHistory, TbAlertTriangle, TbCheck } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface HistoricalIncident {
  id: string;
  date: string;
  title: string;
  similarity: number;
  root_cause: string;
  resolution: string;
  resolved_by: string;
  time_to_resolve_min: number;
  fix_action: 'ld-rollback' | 'github-pr' | 'manual';
  fix_params: Record<string, string>;
}

interface DejaVuPanelProps {
  incidentId: string;
  seed?: boolean;
}

function similarityColor(pct: number) {
  if (pct >= 70) return { bar: 'bg-red-500', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  return { bar: 'bg-slate-500', text: 'text-slate-400', badge: 'bg-slate-700/50 text-slate-400 border-slate-600/30' };
}

export function DejaVuPanel({ incidentId, seed = true }: DejaVuPanelProps) {
  const [incidents, setIncidents] = useState<HistoricalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/similarity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incident_id: incidentId, seed }),
    })
      .then(r => r.json())
      .then(data => { setIncidents(data as HistoricalIncident[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, [incidentId, seed]);

  async function applyFix(inc: HistoricalIncident) {
    setApplying(inc.id);
    try {
      await fetch(`${BASE}/api/remediation/ld-rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_key: inc.fix_params.flag_key, comment: `PulseIQ Deja Vu — applying fix from ${inc.id}` }),
      });
      setApplied(inc.id);
    } catch { /* ignore */ }
    finally { setApplying(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TbHistory className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-slate-700">Incident Deja Vu</h2>
        <span className="text-xs text-slate-400">— we&apos;ve seen this before</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3 text-slate-400">
          <TbLoader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Searching incident history...</span>
        </div>
      )}

      {!loading && incidents.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-center">
          <p className="text-xs text-slate-500">
            {seed ? 'No similar incidents found in history.' : 'No live data — connect Coral to see incident similarity matches'}
          </p>
        </div>
      )}

      {!loading && incidents.length > 0 && (
        <div className="space-y-3">
          {incidents.map(inc => {
            const colors = similarityColor(inc.similarity);
            const isApplied = applied === inc.id;
            const isApplying = applying === inc.id;
            return (
              <div key={inc.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-slate-500">{inc.id}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{inc.date}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${colors.badge}`}>
                        {inc.similarity}% match
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">{inc.title}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Similarity</span>
                    <span className={`font-bold ${colors.text}`}>{inc.similarity}%</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${inc.similarity}%` }} />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-slate-400"><span className="text-slate-500 font-semibold">Root cause:</span> {inc.root_cause}</p>
                  <p className="text-slate-400"><span className="text-slate-500 font-semibold">Resolution:</span> {inc.resolution}</p>
                  <p className="text-slate-500">Fixed by <span className="text-slate-400 font-mono">{inc.resolved_by}</span> in <span className="text-slate-400">{inc.time_to_resolve_min} min</span></p>
                </div>

                {inc.fix_action === 'ld-rollback' && (
                  <button
                    onClick={() => applyFix(inc)}
                    disabled={isApplying || isApplied}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isApplied
                        ? 'bg-emerald-600/20 text-emerald-400 cursor-default'
                        : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isApplied ? <TbCheck className="w-3.5 h-3.5" /> :
                     isApplying ? <TbLoader2 className="w-3.5 h-3.5 animate-spin" /> :
                     <TbAlertTriangle className="w-3.5 h-3.5" />}
                    {isApplied ? 'Fix applied' : isApplying ? 'Applying...' : `Apply same fix — disable \`${inc.fix_params.flag_key}\``}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
