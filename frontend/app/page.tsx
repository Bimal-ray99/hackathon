'use client';

import { useState, useEffect } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { IncidentTimeline } from '@/components/IncidentTimeline';
import { ImpactCard } from '@/components/ImpactCard';
import { QueryViewer } from '@/components/QueryViewer';
import { AnalysisResponse, Incident, getIncidents } from '@/lib/api';

const SEVERITY_BADGE: Record<string, string> = {
  P0: 'bg-red-600 text-white',
  P1: 'bg-orange-500 text-white',
  P2: 'bg-yellow-500 text-white'
};

const STATUS_COLOR: Record<string, string> = {
  active: 'text-red-500',
  investigating: 'text-yellow-500',
  resolved: 'text-green-500'
};

export default function Home() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    getIncidents().then(setIncidents).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white p-4 flex flex-col gap-6 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <h1 className="text-base font-bold text-gray-900">PulseIQ</h1>
          </div>
          <p className="text-xs text-gray-400 ml-8">Powered by Coral</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Incidents
          </p>
          <div className="space-y-2">
            {incidents.map(inc => (
              <div key={inc.id} className="p-3 rounded-lg border hover:border-gray-300 cursor-pointer transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${SEVERITY_BADGE[inc.severity] || 'bg-gray-200 text-gray-700'}`}>
                    {inc.severity}
                  </span>
                  <span className={`text-xs ${STATUS_COLOR[inc.status] || 'text-gray-400'}`}>
                    ● {inc.status}
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-800 leading-tight">{inc.title}</p>
                <p className="text-xs text-red-500 font-mono mt-1">
                  ${inc.mrr_at_risk.toLocaleString()} MRR
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 mb-1">Coral Sources</p>
            <div className="space-y-1">
              {['launchdarkly', 'github', 'sentry', 'slack', 'stripe', 'intercom'].map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-blue-600">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto min-w-0">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Summary banner */}
          {analysis && !loading && (
            <div className="p-4 rounded-xl bg-linear-to-r from-red-50 to-orange-50 border border-red-200">
              <p className="text-gray-900 font-medium leading-relaxed text-sm">
                {analysis.summary}
              </p>
            </div>
          )}

          {/* Chat */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Ask PulseIQ
            </h2>
            <ChatInterface
              onAnalysis={setAnalysis}
              isLoading={loading}
              setLoading={setLoading}
            />
          </div>

          {/* Timeline */}
          {analysis && (
            <div className="bg-white rounded-xl border p-6">
              <IncidentTimeline events={analysis.timeline} />
            </div>
          )}

          {/* Impact + Query side by side */}
          {analysis && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border p-6">
                <ImpactCard
                  mrr_at_risk={analysis.mrr_at_risk}
                  affected_customers={analysis.affected_customers}
                  support_ticket_count={analysis.support_ticket_count}
                  confidence={analysis.confidence}
                />
              </div>
              <div className="bg-white rounded-xl border p-6 space-y-4">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Coral SQL
                </h2>
                <QueryViewer
                  sql={analysis.coral_query}
                  sources={analysis.sources_queried}
                />
                <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Sources joined</span>
                    <span className="font-medium text-gray-600">{analysis.sources_queried.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Query type</span>
                    <span className="font-medium text-gray-600">Cross-source JOIN</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Engine</span>
                    <span className="font-medium text-blue-600">Coral</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
