'use client';

import { TimelineEvent } from '@/lib/api';

// Source chip colors
const SOURCE_CHIP: Record<string, string> = {
  github:       'bg-slate-700 text-slate-100',
  launchdarkly: 'bg-blue-600 text-white',
  sentry:       'bg-red-600 text-white',
  slack:        'bg-purple-600 text-white',
  stripe:       'bg-indigo-600 text-white',
  intercom:     'bg-orange-500 text-white',
};

// Left border + icon bg by severity
const SEVERITY_STYLE: Record<string, { border: string; dot: string; bg: string }> = {
  critical: { border: 'border-l-red-500',    dot: 'bg-red-500',    bg: 'bg-red-950/20' },
  warning:  { border: 'border-l-yellow-400', dot: 'bg-yellow-400', bg: 'bg-yellow-950/10' },
  info:     { border: 'border-l-blue-500',   dot: 'bg-blue-500',   bg: 'bg-blue-950/10' },
};

// Human-readable type labels
const TYPE_LABEL: Record<string, string> = {
  storage_failure:    'STORAGE FAILURE',
  lock_timeout:       'LOCK TIMEOUT',
  data_corruption:    'DATA CORRUPTION',
  validation_error:   'VALIDATION ERROR',
  resource_exhaustion:'POOL EXHAUSTED',
  null_reference:     'NULL REFERENCE',
  error_spike:        'ERROR SPIKE',
  flag_change:        'FLAG CHANGED',
};

const TYPE_COLOR: Record<string, string> = {
  storage_failure:    'text-orange-400',
  lock_timeout:       'text-yellow-400',
  data_corruption:    'text-red-400',
  validation_error:   'text-purple-400',
  resource_exhaustion:'text-rose-400',
  null_reference:     'text-red-300',
  error_spike:        'text-red-400',
  flag_change:        'text-blue-400',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch { return iso; }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (!events.length) return null;

  const criticalCount = events.filter(e => e.severity === 'critical').length;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-widest">Incident Timeline</span>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-300 font-semibold border border-red-800">
              {criticalCount} CRITICAL
            </span>
          )}
          <span className="text-xs text-slate-500">{events.length} events</span>
        </div>
      </div>

      {/* Events */}
      <div className="divide-y divide-slate-100 bg-white">
        {events.map((event, i) => {
          const sev = SEVERITY_STYLE[event.severity || 'info'] ?? SEVERITY_STYLE.info;
          const typeLabel = TYPE_LABEL[event.type] ?? event.type.toUpperCase().replace(/_/g, ' ');
          const typeColor = TYPE_COLOR[event.type] ?? 'text-slate-400';

          return (
            <div
              key={event.id}
              className={`flex gap-0 border-l-4 ${sev.border} ${sev.bg} transition-colors hover:brightness-95`}
              style={{ opacity: 0, animation: `tlFade 0.25s ease forwards ${i * 60}ms` }}
            >
              {/* Timestamp column */}
              <div className="w-28 shrink-0 flex flex-col justify-center px-3 py-3 border-r border-slate-100">
                <span className="text-xs font-mono font-semibold text-slate-700">{formatTime(event.timestamp)}</span>
                <span className="text-xs text-slate-400 mt-0.5">{formatDate(event.timestamp)}</span>
              </div>

              {/* Content */}
              <div className="flex-1 px-4 py-3 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {/* Type label */}
                  <span className={`text-[10px] font-bold tracking-wider ${typeColor}`}>
                    {typeLabel}
                  </span>
                  {/* Source chip */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SOURCE_CHIP[event.source] ?? 'bg-slate-200 text-slate-700'}`}>
                    {event.source}
                  </span>
                </div>
                {/* Title */}
                <p className="text-sm font-medium text-slate-900 leading-snug wrap-break-word">
                  {event.title}
                </p>
                {/* Description */}
                {event.description && event.description !== event.title && (
                  <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                )}
              </div>

              {/* Severity dot */}
              <div className="flex items-center px-3">
                <span className={`w-2.5 h-2.5 rounded-full ${sev.dot} ${event.severity === 'critical' ? 'animate-pulse' : ''}`} />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes tlFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
