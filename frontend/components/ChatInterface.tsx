'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AnalysisResponse, streamAnalyze } from '@/lib/api';
import { SourceBadges } from './SourceBadges';
import { QueryProgress } from './QueryProgress';

const SUGGESTED_QUESTIONS = [
  'Why are uploads failing?',
  'What deployment caused the spike in complaints?',
  'Which bugs are affecting paid customers?',
  'Why are enterprise customers unhappy this week?'
];

interface ChatInterfaceProps {
  onAnalysis: (result: AnalysisResponse) => void;
  isLoading: boolean;
  setLoading: (v: boolean) => void;
  onSourcesUpdate?: (sources: Record<string, { rows: number; live: boolean }>) => void;
}

type Phase = 'idle' | 'querying' | 'gemini' | 'done';

export function ChatInterface({ onAnalysis, isLoading, setLoading, onSourcesUpdate }: ChatInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [doneSources, setDoneSources] = useState<Record<string, { rows: number; live: boolean }>>({});
  const doneSourcesRef = useRef<Record<string, { rows: number; live: boolean }>>({});
  const cancelRef = useRef<(() => void) | null>(null);

  function handleSubmit(q: string) {
    if (!q.trim() || isLoading) return;
    setLoading(true);
    setError(null);
    setPhase('querying');
    setActiveSource(null);
    doneSourcesRef.current = {};
    setDoneSources({});
    setLastAnalysis(null);

    const cancel = streamAnalyze(
      q,
      (event) => {
        if (event.type === 'source_start') {
          setActiveSource(event.data.source as string);
        }
        if (event.type === 'source_done') {
          const src = event.data.source as string;
          const entry = { rows: event.data.rows as number, live: event.data.live as boolean };
          doneSourcesRef.current = { ...doneSourcesRef.current, [src]: entry };
          setActiveSource(null);
          setDoneSources({ ...doneSourcesRef.current });
          onSourcesUpdate?.({ ...doneSourcesRef.current });
        }
        if (event.type === 'gemini_start') {
          setPhase('gemini');
          setActiveSource(null);
        }
      },
      (result) => {
        setLastAnalysis(result);
        onAnalysis(result);
        setPhase('done');
        setLoading(false);
      },
      (err) => {
        setError(err);
        setPhase('idle');
        setLoading(false);
      }
    );
    cancelRef.current = cancel;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit(question)}
          placeholder="Ask anything about your organization..."
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSubmit(question)}
          disabled={isLoading || !question.trim()}
          className="px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : 'Analyze'}
        </Button>
      </div>

      {!lastAnalysis && phase === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => { setQuestion(q); handleSubmit(q); }}
              className="px-3 py-1.5 text-xs rounded-full border border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 text-slate-500 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <QueryProgress
        activeSource={activeSource}
        doneSources={doneSources}
        phase={phase}
      />

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {lastAnalysis && phase === 'done' && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Summary</p>
            <p className="text-white text-sm font-medium leading-relaxed">{lastAnalysis.summary}</p>
          </div>

          {/* Attribution row */}
          {(lastAnalysis.who_caused || lastAnalysis.affected_component) && (
            <div className="grid grid-cols-2 gap-2">
              {lastAnalysis.who_caused && lastAnalysis.who_caused !== 'unknown' && (
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">Who Caused</p>
                  <p className="text-slate-800 text-sm font-mono font-medium">{lastAnalysis.who_caused}</p>
                  {lastAnalysis.source_commit && lastAnalysis.source_commit !== 'not available' && (
                    <p className="text-xs text-slate-500 mt-1 truncate" title={lastAnalysis.source_commit}>
                      &ldquo;{lastAnalysis.source_commit}&rdquo;
                    </p>
                  )}
                </div>
              )}
              {lastAnalysis.affected_component && lastAnalysis.affected_component !== 'unknown' && (
                <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">Affected Component</p>
                  <p className="text-slate-800 text-sm font-mono font-medium">{lastAnalysis.affected_component}</p>
                </div>
              )}
            </div>
          )}

          {/* Root Cause */}
          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">Root Cause</p>
            <p className="text-slate-800 leading-relaxed text-sm">{lastAnalysis.root_cause}</p>
          </div>

          {/* Fix Steps */}
          {lastAnalysis.fix_steps && lastAnalysis.fix_steps.length > 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-3">Fix Steps</p>
              <div className="space-y-2">
                {lastAnalysis.fix_steps.map(s => (
                  <div key={s.step} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {s.step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.action}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Recommended Action</p>
              <p className="text-slate-800 text-sm">{lastAnalysis.recommended_action}</p>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <SourceBadges sources={lastAnalysis.sources_queried} />
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              lastAnalysis.confidence === 'high'   ? 'bg-green-100 text-green-700' :
              lastAnalysis.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                     'bg-red-100 text-red-700'
            }`}>
              {lastAnalysis.confidence} confidence
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
