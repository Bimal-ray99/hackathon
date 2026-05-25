'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AnalysisResponse, analyzeQuestion } from '@/lib/api';
import { SourceBadges } from './SourceBadges';

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
}

export function ChatInterface({ onAnalysis, isLoading, setLoading }: ChatInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(q: string) {
    if (!q.trim() || isLoading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeQuestion(q);
      setLastAnalysis(result);
      onAnalysis(result);
    } catch {
      setError('Analysis failed. Make sure the backend is running on port 4000.');
    } finally {
      setLoading(false);
    }
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
          className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <Button
          onClick={() => handleSubmit(question)}
          disabled={isLoading || !question.trim()}
          className="px-6"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Querying...
            </span>
          ) : 'Analyze'}
        </Button>
      </div>

      {!lastAnalysis && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => { setQuestion(q); handleSubmit(q); }}
              className="px-3 py-1.5 text-xs rounded-full border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Querying 6 sources via Coral SQL JOINs...
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {lastAnalysis && !isLoading && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-gray-50 border">
            <p className="text-xs font-medium text-gray-500 mb-2">Root Cause</p>
            <p className="text-gray-900 leading-relaxed text-sm">{lastAnalysis.root_cause}</p>
          </div>
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-700 mb-1">Recommended Action</p>
            <p className="text-gray-900 text-sm">{lastAnalysis.recommended_action}</p>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <SourceBadges sources={lastAnalysis.sources_queried} />
            <span className={`text-xs px-2 py-1 rounded-full ${
              lastAnalysis.confidence === 'high' ? 'bg-green-100 text-green-700' :
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
