export interface TimelineEvent {
  id: string;
  timestamp: string;
  source: 'github' | 'launchdarkly' | 'sentry' | 'slack' | 'stripe' | 'intercom';
  type: 'deploy' | 'flag_change' | 'error_spike' | 'message' | 'payment' | 'ticket';
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface AffectedCustomer {
  id: string;
  name: string;
  email: string;
  tier: 'enterprise' | 'pro' | 'starter';
  mrr: number;
  ticketId?: string;
}

export interface IncidentAnalysis {
  incidentId: string;
  summary: string;
  root_cause: string;
  affected_customers: AffectedCustomer[];
  mrr_at_risk: number;
  support_ticket_count: number;
  recommended_action: string;
  confidence: 'high' | 'medium' | 'low';
  sources_queried: string[];
  coral_query: string;
  timeline: TimelineEvent[];
}

export interface Incident {
  id: string;
  title: string;
  status: 'active' | 'resolved' | 'investigating';
  severity: 'P0' | 'P1' | 'P2';
  started_at: string;
  resolved_at?: string;
  mrr_at_risk: number;
  affected_customers: number;
}

export interface AnalyzeRequest {
  question: string;
  incident_id?: string;
}
