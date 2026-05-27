export const HERO_QUERY = `SELECT
  name AS flag_name,
  creation_date AS enabled_at,
  'default' AS environment
FROM launchdarkly.feature_flags
WHERE project_key = 'default'
ORDER BY creation_date DESC
LIMIT 1;`;

export const TIMELINE_QUERY = `SELECT 'github' AS source, commit__message AS title, commit__author__date AS timestamp 
FROM github.commits 
WHERE owner = 'Bimal-ray99' AND repo = 'hackathon' 

UNION ALL 

SELECT 'launchdarkly' AS source, name AS title, creation_date AS timestamp 
FROM launchdarkly.feature_flags 
WHERE project_key = 'default' 

ORDER BY timestamp DESC
LIMIT 10;`;

export const IMPACT_QUERY = `SELECT 1;`; // Disabled until Stripe is integrated
