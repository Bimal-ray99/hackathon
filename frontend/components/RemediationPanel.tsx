'use client';

import { useState } from 'react';
import { SiGithub, SiSlack } from 'react-icons/si';
import { TbFlag, TbCheck, TbExternalLink, TbLoader2, TbAlertCircle } from 'react-icons/tb';
import { AnalysisResponse, TimelineEvent } from '@/lib/api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface PRAnalysis {
  verdict: 'approved' | 'needs_changes' | 'risky';
  risk_score: number;
  confidence: 'high' | 'medium' | 'low';
  findings: { type: 'fix' | 'risk' | 'suggestion'; message: string }[];
  summary: string;
  file_path?: string;
  lines_changed?: string[];
  explanation?: string;
}

interface ActionState {
  status: ActionStatus;
  result?: string;   // PR URL or success message
  error?: string;
}

function extractFlagKey(events: TimelineEvent[]): string {
  for (const e of events) {
    if (e.source === 'launchdarkly') {
      const meta = e.metadata as Record<string, unknown> | undefined;
      if (meta?.flag_key) return String(meta.flag_key);
    }
  }
  return 'new-upload-flow';
}

function extractCommitSha(events: TimelineEvent[]): string {
  for (const e of events) {
    if (e.source === 'github') {
      const meta = e.metadata as Record<string, unknown> | undefined;
      if (meta?.commit_sha) return String(meta.commit_sha);
    }
  }
  return 'HEAD~1';
}

const SOURCE_STYLE = {
  github:       { icon: <SiGithub className="w-4 h-4" />,  header: 'bg-slate-900 border-slate-700', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
  launchdarkly: { icon: <TbFlag className="w-4 h-4" />,    header: 'bg-blue-950 border-blue-800',   badge: 'bg-blue-900 text-blue-300 border-blue-700'   },
  slack:        { icon: <SiSlack className="w-4 h-4" />,   header: 'bg-purple-950 border-purple-800', badge: 'bg-purple-900 text-purple-300 border-purple-700' },
};

interface RemediationPanelProps {
  analysis: AnalysisResponse;
}

export function RemediationPanel({ analysis }: RemediationPanelProps) {
  const [states, setStates] = useState<Record<string, ActionState>>({
    github: { status: 'idle' },
    launchdarkly: { status: 'idle' },
    slack: { status: 'idle' },
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prAnalysis, setPrAnalysis] = useState<PRAnalysis | null>(null);
  const [githubStep, setGithubStep] = useState<string | null>(null);

  const flagKey = extractFlagKey(analysis.timeline);
  const commitSha = extractCommitSha(analysis.timeline);
  const mrrFormatted = `$${analysis.mrr_at_risk.toLocaleString()}`;
  const customerCount = analysis.affected_customers.length;

  function setState(id: string, patch: Partial<ActionState>) {
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function executeGitHub() {
    setState('github', { status: 'loading', error: undefined });
    setPrAnalysis(null);

    const steps = [
      'Scanning repo files...',
      'Identifying affected file...',
      'Generating fix with Gemini...',
      'Committing to branch...',
      'Creating PR...',
      'Running AI code review...',
    ];
    let stepIdx = 0;
    setGithubStep(steps[0]);
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setGithubStep(steps[stepIdx]);
    }, 3500);

    try {
      const res = await fetch(`${BASE}/api/remediation/github-pr-with-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root_cause: analysis.root_cause,
          error_title: analysis.summary,
          affected_component: analysis.affected_component ?? 'upload',
          fix_steps: analysis.fix_steps ?? [],
          incident_id: analysis.incidentId,
          who_caused: analysis.who_caused,
          summary: analysis.summary,
          mrr_at_risk: analysis.mrr_at_risk,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      clearInterval(stepTimer);
      setGithubStep(null);
      if (!res.ok) throw new Error((data.error as string) || 'GitHub failed');
      setState('github', { status: 'success', result: data.pr_url as string });
      if (data.pr_analysis) {
        const pa = data.pr_analysis as PRAnalysis;
        pa.file_path = data.file_path as string;
        pa.lines_changed = data.lines_changed as string[];
        pa.explanation = data.explanation as string;
        setPrAnalysis(pa);
      }
    } catch (err) {
      clearInterval(stepTimer);
      setGithubStep(null);
      setState('github', { status: 'error', error: err instanceof Error ? err.message : 'Failed' });
    }
  }

  async function executeLaunchDarkly() {
    setState('launchdarkly', { status: 'loading', error: undefined });
    try {
      const res = await fetch(`${BASE}/api/remediation/ld-rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag_key: flagKey,
          comment: `PulseIQ emergency rollback — ${mrrFormatted} MRR at risk, ${customerCount} Enterprise customers affected. Incident: ${analysis.incidentId}`,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) || 'LaunchDarkly failed');
      setState('launchdarkly', { status: 'success', result: `Flag "${flagKey}" disabled in production` });
    } catch (err) {
      setState('launchdarkly', { status: 'error', error: err instanceof Error ? err.message : 'Failed' });
    }
  }

  async function executeSlack() {
    setState('slack', { status: 'loading', error: undefined });
    const message = `🚨 *Incident Update — ${analysis.incidentId}*

*Status:* Remediation in progress
*Impact:* ${mrrFormatted} MRR at risk · ${customerCount} Enterprise customers · ${analysis.support_ticket_count} tickets

*Root Cause:* ${analysis.root_cause}

*Actions taken:*
• LaunchDarkly flag \`${flagKey}\` — rolling back
• GitHub revert PR opened for commit \`${commitSha}\`

_Diagnosed by PulseIQ in <60s · Powered by Coral SQL JOINs_`;

    try {
      const res = await fetch(`${BASE}/api/remediation/slack-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((data.error as string) || 'Slack failed');
      setState('slack', { status: 'success', result: 'Posted to #incidents' });
    } catch (err) {
      setState('slack', { status: 'error', error: err instanceof Error ? err.message : 'Failed' });
    }
  }

  const actions = [
    {
      id: 'github',
      source: 'github' as const,
      title: 'Generate fix + open PR',
      description: 'Gemini identifies the bug, writes the code fix, commits to a branch, creates a draft PR, then AI-reviews the diff',
      preview: `POST /api/remediation/github-pr-with-fix\n→ Gemini scans repo → generates patch → commits → creates PR → AI reviews diff`,
      cta: 'Generate Fix & PR',
      execute: executeGitHub,
    },
    {
      id: 'launchdarkly',
      source: 'launchdarkly' as const,
      title: `Disable flag: ${flagKey}`,
      description: 'Calls LaunchDarkly API to turn off the flag in production immediately',
      preview: `PATCH /api/v2/flags/default/${flagKey}\n{ "instructions": [{ "kind": "turnFlagOff" }] }`,
      cta: 'Disable flag',
      execute: executeLaunchDarkly,
    },
    {
      id: 'slack',
      source: 'slack' as const,
      title: 'Post incident update',
      description: 'Posts pre-written stakeholder update to your #incidents channel via webhook',
      preview: `#incidents: 🚨 Incident Update — ${analysis.incidentId}\n${mrrFormatted} MRR · ${customerCount} customers · rollback initiated`,
      cta: 'Post to Slack',
      execute: executeSlack,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-700">Remediation</h2>
        </div>
        <span className="text-xs text-slate-400">3 actions · real API calls</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {actions.map((action) => {
          const style = SOURCE_STYLE[action.source];
          const state = states[action.id];
          const isExpanded = expanded === action.id;

          return (
            <div key={action.id} className={`rounded-xl border overflow-hidden ${style.header}`}>

              {/* Header */}
              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`p-1 rounded border ${style.badge}`}>{style.icon}</span>
                  <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    {action.source}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white leading-tight">{action.title}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{action.description}</p>
              </div>

              {/* Preview toggle */}
              <div className="px-4 py-2 border-b border-white/5">
                <button
                  onClick={() => setExpanded(isExpanded ? null : action.id)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono"
                >
                  {isExpanded ? '▾ hide' : '▸ preview'}
                </button>
                {isExpanded && (
                  <pre className="mt-2 text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                    {action.preview}
                  </pre>
                )}
              </div>

              {/* Status + CTA */}
              <div className="px-4 py-3 space-y-2">
                {state.status === 'success' && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <TbCheck className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{state.result}</span>
                  </div>
                )}
                {state.status === 'error' && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400">
                    <TbAlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{state.error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={action.execute}
                    disabled={state.status === 'loading' || state.status === 'success'}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      state.status === 'success'
                        ? 'bg-emerald-600/30 text-emerald-400 cursor-default'
                        : state.status === 'error'
                        ? 'bg-red-600/20 hover:bg-red-600/30 text-red-300'
                        : 'bg-white/10 hover:bg-white/20 text-white/80 disabled:opacity-50'
                    }`}
                  >
                    {state.status === 'loading' ? (
                      <TbLoader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : state.status === 'success' ? (
                      <TbCheck className="w-3.5 h-3.5" />
                    ) : null}
                    {state.status === 'loading'
                      ? (action.id === 'github' && githubStep ? githubStep : 'Executing...')
                      : state.status === 'success' ? 'Done'
                      : state.status === 'error'   ? 'Retry'
                      : action.cta}
                  </button>

                  {state.status === 'success' && state.result?.startsWith('http') && (
                    <a
                      href={state.result}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                    >
                      <TbExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PR Analysis Panel */}
      {prAnalysis && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            prAnalysis.verdict === 'approved'      ? 'bg-emerald-900 border-emerald-700' :
            prAnalysis.verdict === 'needs_changes' ? 'bg-yellow-900 border-yellow-700' :
                                                     'bg-red-900 border-red-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-widest">AI PR Review</span>
              {prAnalysis.file_path && (
                <span className="text-xs font-mono text-white/60">{prAnalysis.file_path}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded font-bold border ${
                prAnalysis.verdict === 'approved'      ? 'bg-emerald-800 text-emerald-200 border-emerald-600' :
                prAnalysis.verdict === 'needs_changes' ? 'bg-yellow-800 text-yellow-200 border-yellow-600' :
                                                         'bg-red-800 text-red-200 border-red-600'
              }`}>
                {prAnalysis.verdict.replace('_', ' ').toUpperCase()}
              </span>
              <span className={`text-xs font-semibold ${
                prAnalysis.risk_score <= 30 ? 'text-emerald-300' :
                prAnalysis.risk_score <= 60 ? 'text-yellow-300' : 'text-red-300'
              }`}>
                Risk {prAnalysis.risk_score}/100
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-700">
            <p className="text-sm text-slate-200 leading-relaxed">{prAnalysis.summary}</p>
          </div>

          {/* What changed */}
          {prAnalysis.explanation && (
            <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Code Changes</p>
              <p className="text-xs text-slate-300 leading-relaxed">{prAnalysis.explanation}</p>
              {prAnalysis.lines_changed && prAnalysis.lines_changed.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {prAnalysis.lines_changed.map((l, i) => (
                    <p key={i} className="text-xs font-mono text-slate-400">• {l}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Findings */}
          <div className="divide-y divide-slate-100">
            {prAnalysis.findings.map((f, i) => (
              <div key={i} className={`flex gap-3 px-4 py-2.5 ${
                f.type === 'fix'        ? 'bg-emerald-50' :
                f.type === 'risk'       ? 'bg-red-50' :
                                          'bg-blue-50'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 w-16 ${
                  f.type === 'fix'        ? 'text-emerald-600' :
                  f.type === 'risk'       ? 'text-red-600' :
                                            'text-blue-600'
                }`}>{f.type}</span>
                <p className="text-xs text-slate-700 leading-relaxed">{f.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
