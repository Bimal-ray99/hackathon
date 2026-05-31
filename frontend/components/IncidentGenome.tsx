'use client';

import { useEffect, useState } from 'react';
import { TbDna, TbCheck, TbX } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PastIncident {
  id: string;
  title: string;
  resolved_in: string;
  resolution: string;
  signals: Record<string, boolean>;
  similarity: number;
}

interface GenomeData {
  incident_id: string;
  current_signals: Record<string, boolean>;
  signal_labels: Record<string, string>;
  matches: PastIncident[];
  top_match: PastIncident;
  recommendation: string;
}

interface IncidentGenomeProps {
  incidentId: string;
}

export function IncidentGenome({ incidentId }: IncidentGenomeProps) {
  const [data, setData] = useState<GenomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/genome?incident_id=${encodeURIComponent(incidentId)}`)
      .then(r => r.json())
      .then((d: GenomeData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [incidentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <span className="w-4 h-4 border-2 border-slate-600 border-t-purple-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Fingerprinting incident...</span>
      </div>
    );
  }

  if (!data) return null;

  const signals = Object.entries(data.current_signals);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <h2 className="text-sm font-semibold text-slate-700">Incident Genome</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">Coral JOINs across time</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {signals.map(([key, active]) => (
          <div
            key={key}
            className={`rounded-xl border p-3 text-center transition-all ${
              active
                ? 'bg-purple-950 border-purple-700/50'
                : 'bg-slate-950 border-slate-800 opacity-40'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center mx-auto mb-1.5 ${
              active ? 'bg-purple-500/20' : 'bg-slate-800'
            }`}>
              {active
                ? <TbCheck className="w-3 h-3 text-purple-400" />
                : <TbX className="w-3 h-3 text-slate-600" />
              }
            </div>
            <p className="text-xs text-slate-400 leading-tight">{data.signal_labels[key]}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.matches.map(match => (
          <div
            key={match.id}
            className={`rounded-xl border p-4 ${
              match.similarity >= 80
                ? 'bg-red-950/30 border-red-800/40'
                : match.similarity >= 50
                ? 'bg-yellow-950/20 border-yellow-800/30'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TbDna className={`w-3.5 h-3.5 ${
                  match.similarity >= 80 ? 'text-red-400' :
                  match.similarity >= 50 ? 'text-yellow-400' : 'text-slate-500'
                }`} />
                <span className="text-xs font-semibold text-slate-200">{match.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">{match.resolved_in}</span>
                <span className={`text-sm font-bold tabular-nums ${
                  match.similarity >= 80 ? 'text-red-400' :
                  match.similarity >= 50 ? 'text-yellow-400' : 'text-slate-500'
                }`}>{match.similarity}%</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  match.similarity >= 80 ? 'bg-red-500' :
                  match.similarity >= 50 ? 'bg-yellow-500' : 'bg-slate-600'
                }`}
                style={{ width: `${match.similarity}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{match.resolution}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-purple-950/30 border border-purple-700/30 px-4 py-3">
        <p className="text-xs text-purple-300 leading-relaxed font-medium">{data.recommendation}</p>
      </div>
    </div>
  );
}
