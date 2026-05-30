import { TimelineEvent, AffectedCustomer, Incident, IncidentAnalysis } from '../types';

export const SEED_TIMELINE: TimelineEvent[] = [
  {
    id: 'evt-001',
    timestamp: '2026-05-15T10:02:00Z',
    source: 'launchdarkly',
    type: 'flag_change',
    title: 'Flag enabled: new-upload-flow',
    description: 'Feature flag "new-upload-flow" enabled for Enterprise tier (100% rollout)',
    severity: 'info',
    metadata: { flag_key: 'new-upload-flow', environment: 'production' }
  },
  {
    id: 'evt-002',
    timestamp: '2026-05-15T10:04:00Z',
    source: 'github',
    type: 'deploy',
    title: 'Commit a3f91b merged',
    description: 'PR #847: Refactor upload service to use streaming API',
    severity: 'info',
    metadata: { commit_sha: 'a3f91b', pr_number: 847 }
  },
  {
    id: 'evt-003',
    timestamp: '2026-05-15T10:15:00Z',
    source: 'sentry',
    type: 'error_spike',
    title: '847 errors in 13 minutes',
    description: "TypeError: Cannot read properties of undefined (reading 'stream')",
    severity: 'critical',
    metadata: { error_count: 847, error_type: 'TypeError' }
  },
  {
    id: 'evt-004',
    timestamp: '2026-05-15T10:18:00Z',
    source: 'slack',
    type: 'message',
    title: '#engineering: Upload errors reported',
    description: '"anyone else seeing upload failures? Getting reports from customers"',
    severity: 'warning',
    metadata: { channel: '#engineering', user: 'sarah.chen' }
  },
  {
    id: 'evt-005',
    timestamp: '2026-05-15T10:21:00Z',
    source: 'slack',
    type: 'message',
    title: '#incidents: P1 declared',
    description: '"P1 declared — upload service broken for Enterprise customers. On-call paged."',
    severity: 'critical',
    metadata: { channel: '#incidents', user: 'oncall-bot' }
  },
  {
    id: 'evt-006',
    timestamp: '2026-05-15T10:35:00Z',
    source: 'intercom',
    type: 'ticket',
    title: '12 Enterprise tickets opened',
    description: 'Customers reporting: "Upload button does nothing", "Files failing to upload"',
    severity: 'critical',
    metadata: { ticket_count: 12 }
  },
  {
    id: 'evt-007',
    timestamp: '2026-05-15T10:47:00Z',
    source: 'launchdarkly',
    type: 'flag_change',
    title: 'Flag rolled back: new-upload-flow',
    description: 'Feature flag "new-upload-flow" disabled — rollback initiated',
    severity: 'info',
    metadata: { flag_key: 'new-upload-flow', action: 'rollback' }
  },
  {
    id: 'evt-008',
    timestamp: '2026-05-15T11:02:00Z',
    source: 'sentry',
    type: 'error_spike',
    title: 'Errors returned to baseline',
    description: 'Error rate dropped from 65/min to 0.3/min after flag rollback',
    severity: 'info',
    metadata: { error_rate_before: 65, error_rate_after: 0.3 }
  }
];

export const SEED_CUSTOMERS: AffectedCustomer[] = [
  { id: 'cus_001', name: 'Acme Corporation', email: 'eng@acme.com', tier: 'enterprise', mrr: 4200, ticketId: 'tkt-001' },
  { id: 'cus_002', name: 'TechFlow Inc', email: 'ops@techflow.io', tier: 'enterprise', mrr: 3800, ticketId: 'tkt-002' },
  { id: 'cus_003', name: 'DataPipe Labs', email: 'admin@datapipe.com', tier: 'enterprise', mrr: 2900 },
  { id: 'cus_004', name: 'Nexus Systems', email: 'cto@nexussys.com', tier: 'enterprise', mrr: 3100, ticketId: 'tkt-003' },
  { id: 'cus_005', name: 'CloudVertex', email: 'support@cloudvertex.io', tier: 'enterprise', mrr: 2600, ticketId: 'tkt-004' },
  { id: 'cus_006', name: 'Orbital Data', email: 'tech@orbitaldata.com', tier: 'enterprise', mrr: 2200 },
  { id: 'cus_007', name: 'Quantum Ops', email: 'eng@quantumops.dev', tier: 'enterprise', mrr: 1900, ticketId: 'tkt-005' },
  { id: 'cus_008', name: 'Stratus Cloud', email: 'infra@stratus.io', tier: 'enterprise', mrr: 2800, ticketId: 'tkt-006' },
  { id: 'cus_009', name: 'Meridian Tech', email: 'ops@meridiantech.com', tier: 'enterprise', mrr: 3400 },
  { id: 'cus_010', name: 'Apex Analytics', email: 'admin@apexanalytics.io', tier: 'enterprise', mrr: 2100, ticketId: 'tkt-007' },
  { id: 'cus_011', name: 'Velocity Corp', email: 'dev@velocitycorp.com', tier: 'enterprise', mrr: 2700 },
  { id: 'cus_012', name: 'Pinnacle SaaS', email: 'cto@pinnaclesaas.com', tier: 'enterprise', mrr: 3500, ticketId: 'tkt-008' }
];

export const SEED_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    title: 'Upload Service Outage — Enterprise',
    status: 'resolved',
    severity: 'P1',
    started_at: '2026-05-15T10:15:00Z',
    resolved_at: '2026-05-15T11:02:00Z',
    mrr_at_risk: 35200,
    affected_customers: 12
  },
  {
    id: 'inc-002',
    title: 'Auth Latency Spike',
    status: 'resolved',
    severity: 'P2',
    started_at: '2026-05-14T14:30:00Z',
    resolved_at: '2026-05-14T15:10:00Z',
    mrr_at_risk: 8400,
    affected_customers: 3
  },
  {
    id: 'inc-003',
    title: 'Dashboard Timeout — Pro Tier',
    status: 'investigating',
    severity: 'P2',
    started_at: '2026-05-15T08:00:00Z',
    mrr_at_risk: 4200,
    affected_customers: 7
  }
];

export const SEED_ANALYSIS: IncidentAnalysis = {
  incidentId: 'inc-001',
  summary: 'Feature flag "new-upload-flow" triggered a cascade failure at 10:02 AM, causing 847 errors in 13 minutes and affecting 12 Enterprise customers representing $35,200 MRR.',
  root_cause: 'The "new-upload-flow" LaunchDarkly flag enabled a new streaming upload implementation that called .stream() on an undefined file object. The code path was not reached in staging because the flag targeted Enterprise tier only in production. Rolling back the flag at 10:47 AM resolved the issue.',
  affected_customers: SEED_CUSTOMERS,
  mrr_at_risk: 35200,
  support_ticket_count: 8,
  recommended_action: 'Fix the null check in the streaming upload handler before re-enabling the flag. Add a staging environment targeting rule to test Enterprise-tier flag changes before production rollout.',
  confidence: 'high',
  sources_queried: ['launchdarkly', 'github', 'sentry', 'slack', 'stripe', 'intercom'],
  coral_query: `SELECT
  ld.name AS flag_name,
  ld.creation_date AS enabled_at,
  s.title AS error_title,
  s.count AS error_count,
  s.first_seen
FROM launchdarkly.feature_flags ld
JOIN sentry.issues s
  ON s.first_seen > ld.creation_date
WHERE ld.archived = false
  AND s.count > 50
ORDER BY s.count DESC`,
  timeline: SEED_TIMELINE
};
