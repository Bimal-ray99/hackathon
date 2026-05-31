'use client';

import { useEffect, useRef, useState } from 'react';
import { SiGithub, SiSentry, SiSlack, SiStripe, SiIntercom } from 'react-icons/si';
import { TbFlag, TbWifi } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Severity = 'info' | 'warning' | 'critical';

interface PulseInsight {
  id: string;
  ts: string;
  sources: string[];
  text: string;
  severity: Severity;
  impact: string;
  live: boolean;
}

const SOURCE_ICON: Record<string, React.ReactNode> = {
  launchdarkly: <TbFlag className="w-3 h-3" />,
  github:       <SiGithub className="w-3 h-3" />,
  sentry:       <SiSentry className="w-3 h-3" />,
  slack:        <SiSlack className="w-3 h-3" />,
  stripe:       <SiStripe className="w-3 h-3" />,
  intercom:     <SiIntercom className="w-3 h-3" />,
};

const SEVERITY_STYLE: Record<Severity, { dot: string; impact: string; border: string }> = {
  critical: { dot: 'bg-red-500 animate-pulse',    impact: 'text-red-400',     border: 'border-l-red-500/60' },
  warning:  { dot: 'bg-yellow-500 animate-pulse', impact: 'text-yellow-400',  border: 'border-l-yellow-500/60' },
  info:     { dot: 'bg-blue-500',                 impact: 'text-emerald-400', border: 'border-l-blue-500/40' },
};

function timeAgo(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface NoiseScore {
  alert_id: string;
  title: string;
  score: number;
  signals: string[];
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (score >= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-slate-700/50 text-slate-500 border-slate-600/30';
}

function matchScore(text: string, scores: NoiseScore[]): NoiseScore | null {
  const lower = text.toLowerCase();
  for (const s of scores) {
    const words = s.title.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    if (words.some(w => lower.includes(w))) return s;
  }
  return null;
}

export function OrgPulseFeed() {
  const [insights, setInsights] = useState<PulseInsight[]>([]);
  const [noiseScores, setNoiseScores] = useState<NoiseScore[]>([]);
  const [connected, setConnected] = useState(false);
  const [, setTick] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  function connect() {
    esRef.current?.close();
    setInsights([]);
    setConnected(false);

    fetch(`${BASE}/api/pulse/snapshot`)
      .then(r => r.json())
      .then((data: PulseInsight[]) => setInsights(data))
      .catch(() => {});

    const es = new EventSource(`${BASE}/api/pulse/stream`);
    esRef.current = es;

    es.addEventListener('insight', (e: MessageEvent) => {
      const insight = JSON.parse(e.data) as PulseInsight;
      setInsights(prev => [insight, ...prev].slice(0, 40));
      setConnected(true);
    });

    es.onerror = () => setConnected(false);
  }

  useEffect(() => {
    connect();
    const tick = setInterval(() => setTick(t => t + 1), 30000);
    return () => {
      esRef.current?.close();
      clearInterval(tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch(`${BASE}/api/noise/scores`)
      .then(r => r.json())
      .then(data => setNoiseScores(data as NoiseScore[]))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Org Pulse Feed</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <TbWifi className={`w-3.5 h-3.5 ${connected ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span className="text-xs text-slate-400">
            {connected ? 'live · Coral only' : 'connecting...'}
          </span>
        </div>
      </div>

      <div className="h-64 overflow-y-auto space-y-1.5 pr-1">
        {insights.length === 0 && (
          <div className="flex items-center gap-2 p-3">
            <span className="w-3.5 h-3.5 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin shrink-0" />
            <span className="text-xs text-slate-500">
              Waiting for live Coral data...
            </span>
          </div>
        )}
        {insights.map((item, i) => {
          const style = SEVERITY_STYLE[item.severity];
          const noise = matchScore(item.text, noiseScores);
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 border-l-2 ${style.border}`}
              style={{ animation: i === 0 ? 'fadeSlideIn 0.3s ease' : undefined }}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <div className="flex items-center gap-1">
                    {item.sources.map(s => (
                      <span key={s} className="text-slate-500">{SOURCE_ICON[s]}</span>
                    ))}
                  </div>
                  <span className="text-xs text-slate-600">·</span>
                  <span className={`text-xs font-mono font-semibold ${style.impact}`}>{item.impact}</span>
                  {item.live && (
                    <span className="text-xs text-emerald-500 font-mono">live</span>
                  )}
                  {noise !== null && (
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded border tabular-nums ml-1 ${scoreColor(noise.score)}`}
                      title={noise.signals.join(', ') || 'No signal match'}
                    >
                      {noise.score}
                    </span>
                  )}
                  <span className="text-xs text-slate-600 ml-auto">{timeAgo(item.ts)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
