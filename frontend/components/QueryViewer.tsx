'use client';

import { useState } from 'react';

interface QueryEntry {
  source: string;
  sql: string;
  rows: number;
  duration_ms: number;
  status: string;
}

interface QueryViewerProps {
  sql: string;
  sources: string[];
  queries_run?: QueryEntry[];
}

const SOURCE_COLOR: Record<string, string> = {
  sentry: 'text-red-400 bg-red-950/40 border-red-800/50',
  launchdarkly: 'text-blue-400 bg-blue-950/40 border-blue-800/50',
  github: 'text-slate-300 bg-slate-800/60 border-slate-700/50',
  slack: 'text-purple-400 bg-purple-950/40 border-purple-800/50',
  stripe: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
  intercom: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
  coral: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50',
};

function sqlPreview(sql: string) {
  return sql.replace(/\s+/g, ' ').trim().slice(0, 100) + (sql.length > 100 ? '…' : '');
}

export function QueryViewer({ sql, sources, queries_run }: QueryViewerProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const entries: QueryEntry[] = queries_run && queries_run.length > 0
    ? queries_run
    : [{ source: sources[0] ?? 'coral', sql, rows: 0, duration_ms: 0, status: 'ok' }];

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 bg-[#0d1117] font-mono text-xs">
      <div className="px-4 py-2.5 border-b border-slate-800 bg-[#161b22] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold">SQL</span>
          <span className="text-slate-200 font-semibold text-sm font-sans">Coral Query History</span>
        </div>
        <span className="text-slate-500">{entries.length} queries</span>
      </div>

      <div className="divide-y divide-slate-800/60">
        {entries.map((q, i) => {
          const colorClass = SOURCE_COLOR[q.source] ?? SOURCE_COLOR.coral;
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              className="px-4 py-2 hover:bg-white/2 cursor-pointer transition-colors"
              onClick={() => setExpanded(isOpen ? null : i)}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase shrink-0 ${colorClass}`}>
                  {q.source}
                </span>
                {q.status === 'error' && (
                  <span className="text-red-400 text-[10px] font-semibold shrink-0">ERR</span>
                )}
                <span className="text-slate-400 truncate flex-1">{sqlPreview(q.sql)}</span>
                <span className="text-slate-600 shrink-0">
                  {q.rows}r · {q.duration_ms}ms
                </span>
                <span className="text-slate-700 ml-1">{isOpen ? '▲' : '▼'}</span>
              </div>
              {isOpen && (
                <pre className="mt-2 ml-1 text-green-400 bg-slate-900/60 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {q.sql}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-800/60 bg-[#161b22] flex items-center justify-between text-[10px] text-slate-600">
        <span>Sources joined: {new Set(entries.map(e => e.source)).size}</span>
        <span>Query type: Cross-source JOIN · Engine: Coral</span>
      </div>
    </div>
  );
}
