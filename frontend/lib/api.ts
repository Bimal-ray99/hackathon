const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  title: string;
  description: string;
  severity?: string;
}

export interface AffectedCustomer {
  id: string;
  name: string;
  email: string;
  tier: string;
  mrr: number;
}

export interface AnalysisResponse {
  incidentId: string;
  summary: string;
  root_cause: string;
  recommended_action: string;
  confidence: 'high' | 'medium' | 'low';
  mrr_at_risk: number;
  affected_customers: AffectedCustomer[];
  support_ticket_count: number;
  sources_queried: string[];
  coral_query: string;
  timeline: TimelineEvent[];
  question: string;
  queries_run?: { source: string; sql: string; rows: number; duration_ms: number; status: string }[];
}

export interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  started_at: string;
  resolved_at?: string;
  mrr_at_risk: number;
  affected_customers: number;
}

export async function analyzeQuestion(
  question: string,
  incident_id = 'inc-001'
): Promise<AnalysisResponse> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, incident_id })
  });
  if (!res.ok) throw new Error('Analysis failed');
  return res.json();
}

export async function getIncidents(): Promise<Incident[]> {
  const res = await fetch(`${BASE}/api/incidents`);
  if (!res.ok) throw new Error('Failed to fetch incidents');
  return res.json();
}

export interface StreamEvent {
  type: 'start' | 'source_start' | 'source_done' | 'gemini_start' | 'complete' | 'error';
  data: Record<string, unknown>;
}

export function streamAnalyze(
  question: string,
  onEvent: (event: StreamEvent) => void,
  onDone: (result: AnalysisResponse) => void,
  onError: (err: string) => void
): () => void {
  const url = `${BASE}/api/stream?question=${encodeURIComponent(question)}`;
  const es = new EventSource(url);

  let completed = false;

  const events = ['start', 'source_start', 'source_done', 'gemini_start', 'complete', 'error'];
  events.forEach(type => {
    es.addEventListener(type, (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      onEvent({ type: type as StreamEvent['type'], data });
      if (type === 'complete') {
        completed = true;
        onDone(data as AnalysisResponse);
        es.close();
      }
      if (type === 'error') {
        completed = true;
        if (data.fallback) onDone(data.fallback as AnalysisResponse);
        else onError(data.message || 'Stream failed');
        es.close();
      }
    });
  });

  es.onerror = () => {
    if (!completed) onError('Connection to backend lost');
    es.close();
  };

  return () => es.close();
}

export interface AnomalySignal {
  source: string;
  signal: string;
  question: string;
}

export async function simulateAnomaly(): Promise<AnomalySignal> {
  const res = await fetch(`${BASE}/api/autopilot/simulate`, { method: 'POST' });
  if (!res.ok) throw new Error('Simulate failed');
  return res.json();
}
