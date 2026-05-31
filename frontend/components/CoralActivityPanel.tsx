'use client';

import { useEffect, useRef, useState } from 'react';

interface CoralQueryEvent {
  id: string;
  timestamp: string;
  sql: string;
  source: string;
  rows: number;
  duration_ms: number;
  status: 'ok' | 'error' | 'seed';
  error?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  sentry: 'text-red-400 bg-red-950/40 border-red-800/50',
  launchdarkly: 'text-blue-400 bg-blue-950/40 border-blue-800/50',
  github: 'text-slate-300 bg-slate-800/60 border-slate-700/50',
  slack: 'text-purple-400 bg-purple-950/40 border-purple-800/50',
  stripe: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
  intercom: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
  coral: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50',
};

const SOURCE_DOT: Record<string, string> = {
  sentry: 'bg-red-400',
  launchdarkly: 'bg-blue-400',
  github: 'bg-slate-400',
  slack: 'bg-purple-400',
  stripe: 'bg-emerald-400',
  intercom: 'bg-orange-400',
  coral: 'bg-cyan-400',
};

function sqlPreview(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().slice(0, 120) + (sql.length > 120 ? '…' : '');
}

function timeLabel(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function CoralActivityPanel() {
  const [events, setEvents] = useState<CoralQueryEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const es = new EventSource(`${BASE}/api/coral/activity`);

    es.addEventListener('history', (e: MessageEvent) => {
      const data = JSON.parse(e.data) as CoralQueryEvent[];
      setEvents(data);
      setConnected(true);
    });

    es.addEventListener('query', (e: MessageEvent) => {
      const event = JSON.parse(e.data) as CoralQueryEvent;
      setEvents(prev => [event, ...prev].slice(0, 50));
    });

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="bg-[#0d1117] border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-slate-200 font-semibold text-sm">Coral Query Log</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500">{events.length} queries</span>
          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="h-72 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600">
            {connected ? 'Waiting for queries…' : 'Connecting…'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {events.map(ev => {
              const colorClass = SOURCE_COLORS[ev.source] || SOURCE_COLORS.coral;
              const dotClass = SOURCE_DOT[ev.source] || SOURCE_DOT.coral;
              const isOpen = expanded === ev.id;

              return (
                <div
                  key={ev.id}
                  className="px-4 py-2 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpanded(isOpen ? null : ev.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 w-16 shrink-0">{timeLabel(ev.timestamp)}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase shrink-0 ${colorClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                      {ev.source}
                    </span>
                    {ev.status === 'error' && (
                      <span className="text-red-400 text-[10px] font-semibold">ERR</span>
                    )}
                    {ev.status === 'seed' && (
                      <span className="text-amber-500 text-[10px] font-semibold">SEED</span>
                    )}
                    <span className="text-slate-400 truncate flex-1">{sqlPreview(ev.sql)}</span>
                    <span className="text-slate-600 shrink-0 ml-2">
                      {ev.status === 'seed' ? '—' : `${ev.rows}r · ${ev.duration_ms}ms`}
                    </span>
                    <span className="text-slate-700 ml-1">{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {isOpen && (
                    <div className="mt-2 ml-[4.5rem]">
                      <pre className="text-slate-300 bg-slate-900/60 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                        {ev.sql}
                      </pre>
                      {ev.error && (
                        <p className="mt-1 text-red-400 text-[11px]">{ev.error}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
