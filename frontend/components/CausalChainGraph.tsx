'use client';

import { useEffect, useState } from 'react';
import { SiGithub, SiSentry, SiSlack, SiStripe, SiIntercom } from 'react-icons/si';
import { TbFlag } from 'react-icons/tb';
import { TimelineEvent } from '@/lib/api';

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  launchdarkly: { bg: 'bg-blue-950',   border: 'border-blue-500/40', text: 'text-blue-300',   dot: 'bg-blue-500'   },
  github:       { bg: 'bg-slate-800',  border: 'border-slate-500/40', text: 'text-slate-300',  dot: 'bg-slate-400'  },
  sentry:       { bg: 'bg-red-950',    border: 'border-red-500/40',   text: 'text-red-300',    dot: 'bg-red-500'    },
  slack:        { bg: 'bg-purple-950', border: 'border-purple-500/40',text: 'text-purple-300', dot: 'bg-purple-500' },
  intercom:     { bg: 'bg-orange-950', border: 'border-orange-500/40',text: 'text-orange-300', dot: 'bg-orange-500' },
  stripe:       { bg: 'bg-indigo-950', border: 'border-indigo-500/40',text: 'text-indigo-300', dot: 'bg-indigo-500' },
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  launchdarkly: <TbFlag className="w-3.5 h-3.5" />,
  github:       <SiGithub className="w-3.5 h-3.5" />,
  sentry:       <SiSentry className="w-3.5 h-3.5" />,
  slack:        <SiSlack className="w-3.5 h-3.5" />,
  intercom:     <SiIntercom className="w-3.5 h-3.5" />,
  stripe:       <SiStripe className="w-3.5 h-3.5" />,
};

const SEVERITY_RING: Record<string, string> = {
  critical: 'ring-2 ring-red-500/50',
  warning:  'ring-2 ring-yellow-500/40',
  info:     '',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

function buildEdgeLabel(from: TimelineEvent, to: TimelineEvent): string {
  if (from.source === 'launchdarkly' && to.source === 'github')   return 'flag → deploy';
  if (from.source === 'launchdarkly' && to.source === 'sentry')   return 'flag → errors';
  if (from.source === 'github'       && to.source === 'sentry')   return 'commit → errors';
  if (from.source === 'sentry'       && to.source === 'slack')    return 'errors → alert';
  if (from.source === 'slack'        && to.source === 'intercom') return 'alert → tickets';
  if (from.source === 'intercom'     && to.source === 'stripe')   return 'tickets → churn';
  if (from.source === 'sentry'       && to.source === 'intercom') return 'errors → tickets';
  return 'Coral JOIN';
}

interface CausalChainGraphProps {
  events: TimelineEvent[];
}

export function CausalChainGraph({ events }: CausalChainGraphProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [events]);

  if (!events.length) return null;

  // Deduplicate: one node per source (first event per source in timeline order)
  const seenSources = new Set<string>();
  const nodes: TimelineEvent[] = [];
  for (const e of events) {
    if (!seenSources.has(e.source)) {
      seenSources.add(e.source);
      nodes.push(e);
    }
  }

  // Edges: connect consecutive nodes across different sources
  const edges: { from: TimelineEvent; to: TimelineEvent; label: string }[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: nodes[i], to: nodes[i + 1], label: buildEdgeLabel(nodes[i], nodes[i + 1]) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Causal Chain</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">{edges.length} Coral JOINs proved causality</span>
      </div>

      {/* Chain */}
      <div
        className="bg-slate-950 rounded-2xl border border-slate-800 p-6 overflow-x-auto"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
      >
        <div className="flex items-center gap-0 min-w-max">
          {nodes.map((node, idx) => {
            const colors = SOURCE_COLORS[node.source] || SOURCE_COLORS.github;
            const edge = edges[idx];
            return (
              <div key={node.id} className="flex items-center">
                {/* Node */}
                <div
                  className={`flex flex-col items-center gap-2 ${SEVERITY_RING[node.severity || 'info']}`}
                  style={{
                    opacity: 0,
                    animation: `chainFadeIn 0.35s ease forwards ${idx * 120}ms`
                  }}
                >
                  <div className={`px-3 py-2.5 rounded-xl border ${colors.bg} ${colors.border} min-w-[120px] max-w-[148px]`}>
                    <div className={`flex items-center gap-1.5 mb-1.5 ${colors.text}`}>
                      {SOURCE_ICON[node.source]}
                      <span className="text-xs font-semibold uppercase tracking-wider">{node.source}</span>
                    </div>
                    <p className="text-xs text-white/80 leading-snug font-medium line-clamp-2">
                      {node.title}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-1.5">
                      {formatTime(node.timestamp)}
                    </p>
                  </div>
                  {/* Severity badge */}
                  {node.severity === 'critical' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                      critical
                    </span>
                  )}
                </div>

                {/* Arrow + label */}
                {edge && (
                  <div
                    className="flex flex-col items-center mx-2 shrink-0"
                    style={{
                      opacity: 0,
                      animation: `chainFadeIn 0.35s ease forwards ${idx * 120 + 80}ms`
                    }}
                  >
                    <span className="text-xs text-slate-500 font-mono mb-1 whitespace-nowrap">
                      {edge.label}
                    </span>
                    <div className="flex items-center gap-0">
                      <div className="w-8 h-px bg-slate-600" />
                      <div className="w-0 h-0 border-t-4 border-b-4 border-l-6 border-t-transparent border-b-transparent border-l-slate-500"
                        style={{ borderLeftWidth: 6 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-slate-600 font-mono">Coral SQL JOINs on:</span>
          {['timestamp', 'customer_id', 'flag_key'].map(field => (
            <span key={field} className="text-xs font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              {field}
            </span>
          ))}
          <span className="ml-auto text-xs text-slate-600">
            {nodes.length} sources · {events.length} events
          </span>
        </div>
      </div>

      <style>{`
        @keyframes chainFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
