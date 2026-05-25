export const HERO_QUERY = `SELECT
  ld.flag_name,
  ld.enabled_at,
  COUNT(s.error_id) AS error_count,
  COUNT(DISTINCT st.customer_id) AS affected_customers,
  SUM(st.mrr) AS mrr_at_risk,
  COUNT(ic.ticket_id) AS support_tickets
FROM launchdarkly.flag_evaluations ld
JOIN sentry.errors s
  ON s.timestamp BETWEEN ld.enabled_at AND ld.enabled_at + INTERVAL '2 hours'
JOIN stripe.customers st
  ON st.id = s.user_id AND st.plan = 'enterprise'
JOIN intercom.conversations ic
  ON ic.user_id = s.user_id
  AND ic.created_at > ld.enabled_at
WHERE ld.environment = 'production'
  AND s.error_count > 50
ORDER BY mrr_at_risk DESC`;

export const TIMELINE_QUERY = `SELECT
  'launchdarkly' AS source, flag_name AS title, enabled_at AS timestamp
FROM launchdarkly.flag_evaluations
WHERE environment = 'production'
UNION ALL
SELECT
  'sentry' AS source, error_type AS title, first_seen AS timestamp
FROM sentry.errors
WHERE error_count > 10
UNION ALL
SELECT
  'slack' AS source, text AS title, created_at AS timestamp
FROM slack.messages
WHERE channel IN ('#incidents', '#engineering')
ORDER BY timestamp ASC`;

export const IMPACT_QUERY = `SELECT
  st.customer_id,
  st.customer_name,
  st.plan,
  st.mrr,
  ic.ticket_id,
  ic.subject AS ticket_subject
FROM stripe.customers st
LEFT JOIN intercom.conversations ic ON ic.user_id = st.customer_id
JOIN sentry.errors s ON s.user_id = st.customer_id
WHERE st.plan = 'enterprise'
  AND s.timestamp > NOW() - INTERVAL '24 hours'
ORDER BY st.mrr DESC`;
