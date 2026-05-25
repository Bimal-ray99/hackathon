# PulseIQ — Organizational Intelligence Engine

> Built for the **Pirates of the Coral-bean Hackathon** (May 25–31, 2026)
> Track 1: Enterprise Agent | Powered by [Coral](https://coral.so)

---

## What Is This?

PulseIQ answers questions like:

- *"Why are uploads failing?"*
- *"What deployment caused the spike in complaints?"*
- *"Which bugs are affecting paid customers?"*
- *"Why are enterprise customers unhappy this week?"*

It does this by running **cross-source SQL JOINs across 6 live data sources** using Coral, then using Gemini AI to explain root cause and business impact in plain English.

No ETL. No data warehouse. No glue code. Just a question — and an answer.

---

## The Demo Scenario

A real incident story, May 15, 2026:

```
10:02 AM  LaunchDarkly: flag "new-upload-flow" enabled → Enterprise tier
10:04 AM  GitHub: commit a3f91b merged (upload service refactor)
10:15 AM  Sentry: 847 errors in 13 minutes — "TypeError: Cannot read .stream()"
10:18 AM  Slack: #engineering "anyone seeing upload failures?"
10:21 AM  Slack: #incidents "P1 declared — Enterprise customers affected"
10:35 AM  Intercom: 12 Enterprise support tickets opened
10:47 AM  LaunchDarkly: flag rolled back
11:02 AM  Sentry: errors return to baseline
```

**AI answer:**
> *"Feature flag 'new-upload-flow' triggered a cascade failure at 10:02 AM, causing 847 errors in 13 minutes and affecting 12 Enterprise customers representing $35,200 MRR."*

This answer comes from a **single Coral SQL JOIN** across LaunchDarkly + Sentry + Stripe + Intercom.

---

## The Core Coral Query

This is the hero moment of the demo — one query that no other tool can run today:

```sql
SELECT
  ld.flag_name,
  ld.enabled_at,
  COUNT(s.error_id)          AS error_count,
  COUNT(DISTINCT st.customer_id) AS affected_customers,
  SUM(st.mrr)                AS mrr_at_risk,
  COUNT(ic.ticket_id)        AS support_tickets
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
ORDER BY mrr_at_risk DESC
```

Coral handles authentication, pagination, rate limits, and schema mapping for all 6 sources automatically.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 + Tailwind v4 + shadcn/ui)         │
│                                                          │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ Sidebar  │  │  Chat + Query │  │ Timeline + Impact │  │
│  │Incidents │  │  Interface    │  │     Cards         │  │
│  └──────────┘  └───────────────┘  └──────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ POST /api/analyze
┌───────────────────────▼─────────────────────────────────┐
│  Backend (Node.js + Express + TypeScript)                │
│                                                          │
│  ┌──────────────┐    ┌───────────────┐                  │
│  │ Coral Client │    │Gemini Analyzer│                  │
│  │ SQL JOIN →   │───▶│ Structured    │                  │
│  │ 6 sources    │    │ JSON output   │                  │
│  └──────┬───────┘    └───────────────┘                  │
└─────────┼───────────────────────────────────────────────┘
          │ SQL JOINs via Coral
┌─────────▼───────────────────────────────────────────────┐
│  Coral Query Layer                                       │
│                                                          │
│  launchdarkly │ github │ sentry │ slack │ stripe │ intercom
└─────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
hackathon/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── index.ts            # Express app + CORS
│   │   ├── types.ts            # Shared TypeScript types
│   │   ├── coral/
│   │   │   ├── client.ts       # Coral connection + query runner
│   │   │   └── queries.ts      # Named SQL JOIN queries
│   │   ├── gemini/
│   │   │   └── analyzer.ts     # Gemini prompt + JSON parser
│   │   ├── routes/
│   │   │   ├── analyze.ts      # POST /api/analyze
│   │   │   ├── incidents.ts    # GET /api/incidents
│   │   │   ├── timeline.ts     # GET /api/timeline/:id
│   │   │   └── impact.ts       # GET /api/impact/:id
│   │   └── seed/
│   │       └── data.ts         # Demo incident data (May 15 upload outage)
│   └── tests/                  # Jest tests — 8 passing
│
├── frontend/                   # Next.js 16 app
│   ├── app/
│   │   ├── page.tsx            # Main dashboard (sidebar + chat + timeline)
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ChatInterface.tsx   # Question input + AI answer
│   │   ├── IncidentTimeline.tsx# Animated event timeline
│   │   ├── ImpactCard.tsx      # MRR at risk, affected customers table
│   │   ├── QueryViewer.tsx     # Expandable Coral SQL display
│   │   └── SourceBadges.tsx    # Colored source indicator chips
│   └── lib/
│       └── api.ts              # Typed fetch client for backend
│
├── coral-specs/
│   └── vercel_deployments.yaml # Custom Coral source spec (bounty submission)
│
└── docs/
    └── superpowers/
        ├── specs/              # Design document
        └── plans/              # Implementation plan
```

---

## Data Sources (via Coral)

| Source | What PulseIQ reads |
|--------|-------------------|
| **LaunchDarkly** | Feature flag rollouts — primary root cause signal |
| **GitHub** | Commits and PRs merged near incident time |
| **Sentry** | Error counts, stack traces, affected user IDs |
| **Slack** | Engineering messages during incident window |
| **Stripe** | Customer MRR, subscription tier |
| **Intercom** | Support ticket volume and content |

---

## API Endpoints

| Method | Endpoint | What it does |
|--------|----------|--------------|
| `POST` | `/api/analyze` | Takes a natural language question, runs Coral JOINs, returns AI analysis |
| `GET` | `/api/incidents` | Lists recent incidents for the sidebar |
| `GET` | `/api/timeline/:id` | Returns event timeline for an incident |
| `GET` | `/api/impact/:id` | Returns business impact (MRR, customers, tickets) |
| `GET` | `/health` | Health check |

### Example request

```bash
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "Why are uploads failing?"}'
```

### Example response

```json
{
  "summary": "Feature flag 'new-upload-flow' triggered a cascade failure at 10:02 AM, causing 847 errors in 13 minutes and affecting 12 Enterprise customers representing $35,200 MRR.",
  "root_cause": "The 'new-upload-flow' LaunchDarkly flag enabled a streaming upload implementation that called .stream() on an undefined file object...",
  "recommended_action": "Fix the null check in the streaming upload handler before re-enabling the flag.",
  "confidence": "high",
  "mrr_at_risk": 35200,
  "support_ticket_count": 8,
  "sources_queried": ["launchdarkly", "github", "sentry", "slack", "stripe", "intercom"],
  "coral_query": "SELECT ld.flag_name, ...",
  "timeline": [...],
  "affected_customers": [...]
}
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm

### Step 1 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add GEMINI_API_KEY for live AI (leave blank to use seed data)
npm install
npm run dev
# Runs on http://localhost:4000
```

### Step 2 — Frontend

```bash
cd frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:4000
npm install
npm run dev
# Runs on http://localhost:3000
```

### Step 3 — Open and demo

1. Go to `http://localhost:3000`
2. Click **"Why are uploads failing?"**
3. Watch: loading state → summary banner → timeline → $35,200 MRR impact card → Coral SQL query reveal

No API keys required — seed data powers the full demo flow.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Optional | Gemini 1.5 Pro API key. If blank, uses seed responses. |
| `CORAL_API_URL` | Optional | Coral local server URL. If blank, uses seed data. |
| `CORAL_USE_SEED` | Optional | Set `true` to force seed mode. |
| `PORT` | Optional | Backend port (default: 4000) |
| `FRONTEND_URL` | Optional | CORS origin (default: http://localhost:3000) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Optional | Backend URL (default: http://localhost:4000) |

---

## Deploying

### Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Set root directory to `/backend`
3. Add environment variables from `backend/.env.example`
4. Railway reads the `Procfile` — runs `node dist/index.js`

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your Railway backend URL when prompted
```

---

## Running Tests

```bash
cd backend
npm test
```

**8 tests, all passing:**
- `CoralClient` — seed query, incident query shape
- `GeminiAnalyzer` — structured response fields
- `POST /api/analyze` — returns analysis, 400 on missing question
- `GET /api/incidents` — returns incident list
- `GET /api/timeline/:id` — returns timeline events
- `GET /api/impact/:id` — returns MRR and customers

---

## Custom Coral Source Spec

`coral-specs/vercel_deployments.yaml` adds Vercel deployment history as a Coral SQL source.

This enables a JOIN like:

```sql
SELECT v.uid, v.git_sha, v.created_at, COUNT(s.error_id)
FROM vercel_deployments.deployments v
JOIN sentry.errors s
  ON s.timestamp BETWEEN v.created_at AND v.created_at + INTERVAL '1 hour'
WHERE v.target = 'production'
ORDER BY s.error_count DESC
```

Submitted for the **$100 cash bounty** (top 10 custom source specs).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, Tailwind CSS v4, shadcn/ui |
| Backend | Node.js, Express, TypeScript |
| AI | Gemini 1.5 Pro (structured JSON mode) |
| Query Layer | Coral (cross-source SQL JOINs) |
| Testing | Jest + Supertest |
| Deploy | Vercel (frontend) + Railway (backend) |

---

## Why This Wins

| Judging Criterion | How PulseIQ addresses it |
|-------------------|--------------------------|
| **Impact** | Real enterprise pain — incidents cost millions. Clear ROI: one query saves hours of investigation. |
| **Creativity** | LaunchDarkly + Sentry + Stripe JOIN doesn't exist in any tool today. |
| **Technical implementation** | 6-source Coral JOIN + Gemini structured output + typed Express API + 8 passing tests. |
| **Aesthetics/UX** | Clean sidebar + animated timeline + impact cards + SQL reveal moment. |
| **Coral utilization** | SQL JOINs are visible and central — the query viewer is a core UI element. |
| **Learning/growth** | Custom source spec shows depth beyond tutorial-level Coral usage. |
