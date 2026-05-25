'use client';

import { TimelineEvent } from '@/lib/api';

const SOURCE_DOT: Record<string, string> = {
  github: 'bg-gray-700',
  launchdarkly: 'bg-blue-600',
  sentry: 'bg-red-600',
  slack: 'bg-purple-600',
  stripe: 'bg-indigo-600',
  intercom: 'bg-orange-500'
};

const SOURCE_BADGE: Record<string, string> = {
  github: 'bg-gray-700 text-white',
  launchdarkly: 'bg-blue-600 text-white',
  sentry: 'bg-red-600 text-white',
  slack: 'bg-purple-600 text-white',
  stripe: 'bg-indigo-600 text-white',
  intercom: 'bg-orange-500 text-white'
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-red-400',
  warning: 'border-yellow-400',
  info: 'border-gray-200'
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (!events.length) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Incident Timeline
      </h2>
      <div className="relative">
        <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-3">
          {events.map((event, i) => (
            <div
              key={event.id}
              className="flex gap-4"
              style={{
                opacity: 0,
                animation: `fadeIn 0.3s ease forwards ${i * 80}ms`
              }}
            >
              <div className="w-20 text-right pt-0.5 shrink-0">
                <span className="text-xs text-gray-400 font-mono">
                  {formatTime(event.timestamp)}
                </span>
              </div>
              <div className="relative flex items-start pt-1.5 z-10">
                <div className={`w-3 h-3 rounded-full ring-2 ring-white ${SOURCE_DOT[event.source] || 'bg-gray-400'}`} />
              </div>
              <div className={`flex-1 pb-3 border-b last:border-0 ${SEVERITY_BORDER[event.severity || 'info']}`}>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">
                    {event.title}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${SOURCE_BADGE[event.source] || 'bg-gray-200 text-gray-700'}`}>
                    {event.source}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {event.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
