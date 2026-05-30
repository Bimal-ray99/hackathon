'use client';

import { useState } from 'react';
import { TbSparkles, TbLoader2, TbCopy, TbCheck, TbFileText } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PostmortemPanelProps {
  incidentId: string;
  seed?: boolean;
}

export function PostmortemPanel({ incidentId, seed = true }: PostmortemPanelProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [geminiUsed, setGeminiUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/postmortem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, seed }),
      });
      const data = await res.json() as { markdown?: string; gemini_used?: boolean; error?: string };
      if (data.error || !data.markdown) {
        setError(data.error ?? 'No live Coral data available for postmortem generation');
      } else {
        setMarkdown(data.markdown);
        setGeminiUsed(data.gemini_used ?? false);
      }
    } catch { setError('Failed to connect to backend'); }
    finally { setLoading(false); }
  }

  function copy() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!markdown && !loading) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={generate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-purple-500/50 text-xs font-semibold text-slate-300 hover:text-white transition-all group w-fit"
        >
          <TbFileText className="w-3.5 h-3.5 text-purple-400 group-hover:animate-pulse" />
          Auto-Generate Postmortem
          <span className="text-slate-600 font-normal">Coral JOIN × Gemini → full report</span>
        </button>
        {error && (
          <p className="text-xs text-slate-500 pl-1">{error}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
        <TbLoader2 className="w-4 h-4 text-purple-400 animate-spin" />
        <span className="text-xs text-slate-400">Querying 6 sources via Coral → Gemini writing postmortem...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <h2 className="text-sm font-semibold text-slate-700">Auto-Generated Postmortem</h2>
          {geminiUsed && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
              <TbSparkles className="w-3 h-3" /> Gemini
            </span>
          )}
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs text-slate-600 font-medium transition-colors"
        >
          {copied ? <TbCheck className="w-3.5 h-3.5 text-emerald-500" /> : <TbCopy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
        <pre className="p-5 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
          {markdown}
        </pre>
      </div>
    </div>
  );
}
