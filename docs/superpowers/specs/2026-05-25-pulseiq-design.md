# PulseIQ — Design Spec
Date: 2026-05-25
Hackathon: Pirates of the Coral-bean (Track 1 — Enterprise Agent)
Deadline: 2026-05-31
Team: 2 full-stack devs

---

## Problem

Enterprise teams use 5+ disconnected tools. Incidents start in one platform (a deploy, a flag rollout) and silently cascade into crashes, support tickets, and revenue loss. No tool joins these signals into one explanation.

## Solution

PulseIQ queries GitHub, LaunchDarkly, Sentry, Slack, Stripe, and Intercom through Coral's cross-source SQL JOIN layer, then uses Gemini to explain root cause and business impact in plain English.

## Winning Demo Sentence

> "Feature flag `new-upload-flow` was enabled for Enterprise tier at 10:02 AM. Sentry logged 847 errors in 13 minutes. 12 Stripe Enterprise customers filed support tickets. $34K ARR is at risk."

This sentence is the product. Everything else exists to produce it.

---

## Architecture

```
repo/
├── frontend/          # Next.js 14 + Tailwind + shadcn/ui
│   ├── app/
│   │   ├── page.tsx           # Main chat + dashboard
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx   # AI question/answer
│   │   ├── IncidentTimeline.tsx# Visual event timeline
│   │   ├── ImpactCard.tsx      # Business impact summary
│   │   ├── QueryViewer.tsx     # Shows Coral SQL (key for judges)
│   │   └── SourceBadges.tsx    # Shows which sources were JOINed
│   └── lib/
│       └── api.ts             # Backend client
│
└── backend/           # Node.js + Express
    ├── routes/
    │   ├── analyze.ts         # POST /api/analyze
    │   ├── incidents.ts       # GET /api/incidents
    │   ├── timeline.ts        # GET /api/timeline/:id
    │   └── impact.ts          # GET /api/impact/:id
    ├── coral/
    │   ├── client.ts          # Coral connection + query runner
    │   ├── queries.ts         # Named JOIN queries
    │   └── sources.ts         # Source configs
    ├── gemini/
    │   └── analyzer.ts        # Gemini prompt + response parser
    └── seed/
        └── scenario.ts        # Demo incident data (May 15 upload outage)
```

---

## Data Flow

```
1. User types: "Why are uploads failing?"
2. Frontend POST /api/analyze { question }
3. Backend detects intent → selects query template
4. Coral runs SQL JOIN across 5 sources
5. Results passed to Gemini with structured prompt
6. Gemini returns { summary, root_cause, affected_customers, mrr_at_risk, query_used, timeline }
7. Frontend renders: chat answer + timeline + impact card + query viewer
```

---

## Backend

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/analyze | Main AI query, returns full incident analysis |
| GET | /api/incidents | List recent incidents for sidebar |
| GET | /api/timeline/:id | Event timeline for specific incident |
| GET | /api/impact/:id | Business impact breakdown |

### Core Coral Query (hero query for demo)

```sql
SELECT
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
  ON st.id = s.user_id
JOIN intercom.conversations ic
  ON ic.user_id = s.user_id
  AND ic.created_at > ld.enabled_at
WHERE ld.environment = 'production'
  AND s.error_count > 50
ORDER BY mrr_at_risk DESC
```

### Gemini Prompt Structure

```
System: You are an incident analysis AI. Given cross-source data from engineering and business tools, explain what went wrong in plain English. Always include root cause, business impact, and a recommended action.

User context: [Coral JOIN results as JSON]
User question: [original question]

Return JSON: { summary, root_cause, affected_customers[], mrr_at_risk, recommended_action, confidence }
```

### Coral Sources

| Source | Data Used |
|--------|-----------|
| `github` | Commits, PRs merged around incident time |
| `launchdarkly` | Feature flag rollouts (primary root cause signal) |
| `sentry` | Error counts, stack traces, affected user IDs |
| `slack` | Engineering messages during incident window |
| `stripe` | Customer MRR, subscription tier |
| `intercom` | Support ticket volume and content |

---

## Frontend

### Pages

Single page app with 3 panels:

**Left sidebar:** Recent incidents list with severity badges

**Main panel (top):** AI chat interface
- Input: natural language question
- Output: AI explanation with source attribution
- Shows which Coral sources were queried (badges)

**Main panel (bottom):** Incident timeline
- Visual horizontal timeline
- Events color-coded by source (deploy=blue, error=red, ticket=orange, message=yellow)
- Hover shows detail

**Right panel:** Impact card
- Affected customers count
- MRR at risk (big number)
- Support ticket count
- Expandable Coral SQL query (key judge moment)

### Key UI Moments for Judges

1. Question submitted → "Querying 5 sources via Coral..." loading state
2. Timeline animates in with colored events
3. Impact card shows $34K MRR at risk in large red text
4. "View Query" expands to show the actual Coral SQL JOIN
5. Source badges show: GitHub + LaunchDarkly + Sentry + Stripe + Intercom

---

## Seed Data — Demo Scenario

**Incident: May 15, 2026 — Upload Service Outage**

```
10:02 AM  LaunchDarkly: flag 'new-upload-flow' enabled → Enterprise tier
10:04 AM  GitHub: commit a3f91b merged (upload refactor)
10:15 AM  Sentry: error spike begins — "TypeError: undefined is not a function"
10:18 AM  Slack: #engineering "anyone seeing upload errors?"
10:21 AM  Slack: #incidents "P1 declared — upload broken for enterprise"
10:35 AM  Intercom: 12 enterprise customer tickets opened
10:47 AM  LaunchDarkly: flag rolled back
11:02 AM  Sentry: errors return to baseline
```

Affected: 12 Enterprise Stripe customers, $34,200 MRR at risk

---

## Custom Coral Source Spec (Bonus Bounty)

Write a custom spec for `vercel_deployments` — not yet in Coral.
Captures: deployment ID, timestamp, URL, status, git SHA, team.
Enables query: JOIN sentry errors ON deployment timestamp window.
Targets $100 cash bounty + signals deep Coral mastery.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Node.js, Express, TypeScript |
| AI | Gemini 1.5 Pro (function calling + JSON mode) |
| Query | Coral MCP / SDK |
| Deploy | Vercel (frontend) + Railway/Render (backend) |

---

## Dev Split (6 days)

| Dev | Focus |
|-----|-------|
| Dev 1 | Backend: Coral setup, queries, Gemini integration, API routes |
| Dev 2 | Frontend: UI components, timeline, impact card, chat interface |

### Day-by-day

| Day | Dev 1 | Dev 2 |
|-----|-------|-------|
| 1 | Coral setup + seed data + hero query working | Project scaffold + component shells |
| 2 | All 6 source queries + /api/analyze endpoint | Chat interface + query viewer |
| 3 | Gemini integration + structured response | Timeline component + impact card |
| 4 | Polish endpoints + error handling | UI polish + animations + mobile |
| 5 | Custom Coral source spec (vercel) | Demo flow rehearsal + video recording |
| 6 | Buffer / fixes | Buffer / deploy |

---

## Judging Criteria Mapping

| Criterion | How PulseIQ wins it |
|-----------|---------------------|
| Impact | Real enterprise pain: incidents cost $M. Clear ROI story. |
| Creativity | LaunchDarkly + Sentry + Stripe JOIN doesn't exist anywhere else |
| Technical implementation | 5-source Coral JOIN + Gemini structured output + clean API |
| Aesthetics/UX | Polished timeline, impact card, animated query reveal |
| Coral utilization | SQL JOINs are visible and central, not hidden |
| Learning/growth | Custom source spec shows depth beyond tutorial usage |
