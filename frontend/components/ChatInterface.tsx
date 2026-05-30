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
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Root Cause</p>
            <p className="text-slate-800 leading-relaxed text-sm">{lastAnalysis.root_cause}</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Recommended Action</p>
            <p className="text-slate-800 text-sm">{lastAnalysis.recommended_action}</p>
          </div>
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
