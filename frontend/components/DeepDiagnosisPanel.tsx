'use client';

import { useState } from 'react';
import { SiGithub } from 'react-icons/si';
import { TbChevronDown, TbChevronRight, TbSparkles, TbLoader2, TbCheck, TbAlertCircle } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface DiagnosisFile {
  filename: string;
  additions: number;
  deletions: number;
  patch: string;
}

interface DiagnosisResult {
  sha: string;
  message: string;
  author: string;
  date: string;
  files: DiagnosisFile[];
  hints: string[];
  gemini_used: boolean;
  source: 'live' | 'seed';
}

interface DeepDiagnosisPanelProps {
  flagKey: string;
  incidentId: string;
  onPrSha?: (sha: string) => void;
}

function DiffViewer({ file }: { file: DiagnosisFile }) {
  const [open, setOpen] = useState(false);
  const lines = file.patch.split('\n');

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <TbChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <TbChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          <span className="text-xs font-mono text-slate-300 truncate">{file.filename}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xs font-mono text-emerald-400">+{file.additions}</span>
          <span className="text-xs font-mono text-red-400">-{file.deletions}</span>
        </div>
      </button>
      {open && (
        <div className="bg-slate-950 overflow-x-auto">
          <pre className="text-xs font-mono leading-relaxed p-3">
            {lines.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('+') && !line.startsWith('+++')
                    ? 'bg-emerald-950/40 text-emerald-300'
                    : line.startsWith('-') && !line.startsWith('---')
                    ? 'bg-red-950/40 text-red-300'
                    : line.startsWith('@@')
                    ? 'text-blue-400'
                    : 'text-slate-400'
                }
              >
                {line || ' '}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

export function DeepDiagnosisPanel({ flagKey, incidentId, onPrSha }: DeepDiagnosisPanelProps) {
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prStatus, setPrStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [prUrl, setPrUrl] = useState<string | null>(null);

  async function runDiagnosis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_key: flagKey, incident_id: incidentId }),
      });
      if (!res.ok) throw new Error('Diagnosis failed');
      setResult(await res.json() as DiagnosisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function createPrecisePR() {
    if (!result) return;
    setPrStatus('loading');
    try {
      const res = await fetch(`${BASE}/api/remediation/github-pr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `fix: revert ${result.sha} — PulseIQ deep diagnosis`,
          body: `## Deep Diagnosis Revert\n\nPulseIQ identified commit \`${result.sha}\` by ${result.author} as root cause.\n\n**Commit:** ${result.message}\n\n**Root cause:**\n${result.hints[0]}\n\n**Fix:**\n${result.hints[1]}\n\n---\n*Diagnosed by PulseIQ — Coral RAG Pipeline*`,
          head: result.sha,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error));
      setPrUrl(data.pr_url as string);
      setPrStatus('done');
      onPrSha?.(result.sha);
    } catch {
      setPrStatus('error');
    }
  }

  if (!result && !loading) {
    return (
      <button
        onClick={runDiagnosis}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-blue-500/50 text-xs font-semibold text-slate-300 hover:text-white transition-all group"
      >
        <TbSparkles className="w-3.5 h-3.5 text-blue-400 group-hover:animate-pulse" />
        Deep Diagnosis — find exact commit + diff
        <span className="text-slate-600 font-normal">Coral JOIN × GitHub diff × Gemini</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
        <TbLoader2 className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="text-xs text-slate-400">Running causal JOIN → fetching diff → Gemini analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-950/20 border border-red-800/40">
        <TbAlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-xs text-red-400">{error}</span>
        <button onClick={runDiagnosis} className="ml-auto text-xs text-slate-400 hover:text-white">retry</button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold text-slate-700">Deep Diagnosis</h2>
          {result.gemini_used && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
              <TbSparkles className="w-3 h-3" /> Gemini
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono">live Coral + GitHub</span>
      </div>

      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4">
        {/* Commit info */}
        <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
          <div className="p-2 rounded-lg bg-slate-800 shrink-0">
            <SiGithub className="w-4 h-4 text-slate-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{result.sha}</span>
              <span className="text-xs text-slate-500">by {result.author}</span>
              <span className="text-xs text-slate-600">{new Date(result.date).toLocaleString()}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">{result.message}</p>
          </div>
        </div>

        {/* Diff viewer */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Changed files</p>
          {result.files.map(f => (
            <DiffViewer key={f.filename} file={f} />
          ))}
        </div>

        {/* Gemini hints */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <TbSparkles className="w-3.5 h-3.5 text-purple-400" />
            Fix recommendations
          </p>
          {result.hints.map((hint, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-xs font-bold text-slate-600 shrink-0 mt-0.5">{i + 1}.</span>
              <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900 rounded-lg px-3 py-2 flex-1">{hint}</p>
            </div>
          ))}
        </div>

        {/* PR button */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
          <button
            onClick={createPrecisePR}
            disabled={prStatus === 'loading' || prStatus === 'done'}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              prStatus === 'done'
                ? 'bg-emerald-600/20 text-emerald-400 cursor-default'
                : prStatus === 'error'
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'
            }`}
          >
            {prStatus === 'loading' ? <TbLoader2 className="w-3.5 h-3.5 animate-spin" /> :
             prStatus === 'done' ? <TbCheck className="w-3.5 h-3.5" /> : <SiGithub className="w-3.5 h-3.5" />}
            {prStatus === 'done' ? 'PR created' : prStatus === 'error' ? 'Retry' : `Revert ${result.sha}`}
          </button>
          {prStatus === 'done' && prUrl && (
            <a href={prUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline font-mono truncate">
              {prUrl}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
