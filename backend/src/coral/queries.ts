export const HERO_QUERY = `SELECT
  name AS flag_name,
  creation_date AS enabled_at,
  'default' AS environment
FROM launchdarkly.feature_flags
WHERE project_key = 'default'
ORDER BY creation_date DESC
LIMIT 1;`;

// Sentry-only timeline — safe when GitHub/LD not connected
export const TIMELINE_QUERY = `SELECT 'sentry' AS source, title, culprit AS description, first_seen AS timestamp
FROM sentry.issues
ORDER BY first_seen DESC
LIMIT 15`;

export const IMPACT_QUERY = `SELECT 1;`; // Disabled until Stripe is integrated
