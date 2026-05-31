<img width="1983" height="793" alt="image" src="https://github.com/user-attachments/assets/752e81cb-15a1-48f8-8256-c8b0a90b2605" />


# PulseIQ — Incident Intelligence on Coral

> Pirates of the Coral-bean Hackathon · May 2026 · Track 1: Enterprise Agent

---

## What it is

When something breaks in production, you normally open Sentry, then LaunchDarkly, then GitHub, then Slack — manually correlating timestamps across four tabs. That takes 45 minutes on a good day.

PulseIQ does that correlation in one query. You type a question, it runs SQL JOINs across your connected sources via Coral, feeds the actual rows into Gemini, and gives you a structured answer: what broke, who caused it, and how to fix it. Then it optionally fixes it for you.

---

## Infrastructure

<img width="1693" height="929" alt="image" src="https://github.com/user-attachments/assets/d5e19ce0-b037-4910-8a85-af36dec208eb" />


### How Coral queries actually run

`CoralClient` wraps the Coral CLI. Every query is a shell exec:

```
coral sql --format json "SELECT title, level FROM sentry.issues WHERE status = 'unresolved'"
```

Output comes back as JSON, NDJSON, or pipe-separated table — the client handles all three. Each query is timed, logged to an in-memory activity ring (last 50 queries), and emitted on an `EventEmitter` bus so the frontend's Coral Activity panel can show live SQL with row counts and durations.

Six sources are wired: `sentry`, `launchdarkly`, `github`, `slack`, `stripe`, `intercom`. Source is inferred from the SQL text (table prefix matching) so the activity log knows which system each query hit.

Per-source timeouts: GitHub gets 12s, everything else 20s. All four analysis queries run in `Promise.allSettled` — one slow or dead source never blocks the others.

<img width="1024" height="1536" alt="image" src="https://github.com/user-attachments/assets/ea083a73-e7fd-48bd-afee-988b51a2ab1f" />


### The Gemini integration

`GeminiAnalyzer` uses `@google/generative-ai` with `responseMimeType: 'application/json'` and temperature 0.4. Three methods:

**`analyze(question, incidentData, ragContext)`**  
Takes real Coral rows (stack traces, flag details, commit messages, Slack messages), ranks them by keyword overlap with the question, builds a prompt that puts the question at the top and the raw rows immediately after. Returns structured JSON: `summary`, `root_cause`, `who_caused`, `source_commit`, `affected_component`, `fix_steps[]`, `confidence`.

The prompt explicitly says: *"Every claim MUST reference specific data from the rows below. Do not infer or guess."* This grounds the output — Gemini can only cite what Coral actually returned.

**`generateCodeFix(filePath, fileContent, rootCause, fixSteps)`**  
Sends the full file source + the root cause + fix steps from the Coral analysis. Returns the complete fixed file content, a plain-English explanation, and which lines changed. Seed fallback ships a real fixed `upload.js` with four genuine bug fixes (TTL 300→900s, lock retry logic, checksum normalisation, pool connection reduction).

**`reviewPRDiff(diff, rootCause)`**  
Takes the raw GitHub diff text and the root cause. Returns verdict (`approved` / `needs_changes` / `risky`), a 0–100 risk score, and per-finding analysis tagged as `fix`, `risk`, or `suggestion`.

### SSE streaming

Analysis and autopilot both use Server-Sent Events, not polling. The frontend opens an `EventSource`, and the backend writes named events as work progresses:

```
event: start
event: source_start   (one per Coral source)
event: source_done    (rows count, live/seed flag)
event: gemini_start
event: complete       (full analysis payload)
event: remediation_complete  (autopilot only)
```

This means the UI updates incrementally — you see each Coral source connect or fail in real time before Gemini even starts.

### The GitHub code fix pipeline

<img width="1024" height="1536" alt="image" src="https://github.com/user-attachments/assets/0f8944c3-be5e-4ccf-bf2b-f792577a136a" />


When you click Generate Fix & PR, the backend does 8 sequential GitHub API calls:

1. `GET /git/trees/HEAD?recursive=1` — full repo file tree
2. Score every source file by keyword overlap with `affected_component` and the error title — picks the best match
3. `GET /contents/{path}` — fetch file + its SHA (needed for the PUT)
4. `generateCodeFix()` — Gemini writes the patch
5. POST to create a new branch off main
6. `PUT /contents/{path}` — commit the fixed file (requires the original SHA)
7. `POST /pulls` — create draft PR with structured body: incident metadata table, root cause, causal attribution, fix checklist from `fix_steps[]`
8. `GET /pulls/{n}/files` → `reviewPRDiff()` — Gemini reads its own diff and returns verdict + findings

Everything has a seed fallback — if `GITHUB_TOKEN` is unset or any step fails, the UI shows the same panels with realistic static data.

### Autopilot

<img width="1098" height="1432" alt="image" src="https://github.com/user-attachments/assets/80de62cf-6ab8-446c-a235-85a4f10749a5" />


A polling loop runs on `GET /api/autopilot/stream`. Every 15s it queries `sentry.issues` for unresolved error count. When count exceeds threshold it fires:

1. Full Coral RAG analysis (same pipeline as manual query)
2. `POST /api/remediation/ld-rollback` — disables the flag
3. `POST /api/remediation/github-pr-with-fix` — full code fix flow above
4. `POST /api/remediation/slack-post` — structured incident message to #incidents

All three remediation steps run in parallel. When done, it emits `remediation_complete` on the SSE stream with timing data.

## The demo flow

1. The victim service (`pulseiq-victim-service`) runs a real Express app with a LaunchDarkly flag wired to 5 error classes in Sentry
2. You enable the flag — this triggers a StorageBackendError cascade, UploadValidationErrors, lock timeouts, etc.
3. You hit `/blast` — fires 50 uploads, generating ~40 Sentry errors fingerprinted as one issue
4. Open PulseIQ, ask: *"Why are enterprise customers seeing errors?"*
5. Watch: Coral queries fire in parallel across sentry + launchdarkly + github + slack → Gemini synthesises → structured root cause lands in ~15s
6. Click **Generate Fix & PR** → Gemini identifies the file, writes a fix, commits it, opens a draft PR on GitHub, then reviews its own diff
7. Enable **Autopilot** → Simulate → it detects the anomaly, runs analysis, disables the flag, opens the PR, posts to Slack — no clicks

---

## How Coral is used

Coral is the retrieval layer for every feature. Not a vector database, not embeddings — actual SQL rows from real sources injected directly into Gemini.

### The core query

```sql
SELECT
  ld.key            AS flag,
  ld.creation_date  AS enabled_at,
  s.title           AS top_error,
  g.commit__message AS last_commit,
  g.commit__author__name AS author
FROM launchdarkly.feature_flags ld
JOIN sentry.issues s
  ON s.first_seen BETWEEN ld.creation_date
                  AND ld.creation_date + INTERVAL '2 hours'
JOIN github.commits g
  ON g.commit__author__date BETWEEN ld.creation_date - INTERVAL '30 minutes'
                             AND ld.creation_date + INTERVAL '10 minutes'
WHERE s.status = 'unresolved'
ORDER BY s.count DESC
LIMIT 1
```

Flag + error + commit — three systems, one query.

### RAG pipeline

```
Question: "Why are uploads failing?"
       │
       ▼
4 parallel Coral queries (per-source 12–20s timeout):
  sentry.issues        → "StorageBackendError: S3 presigned URL expired"
  launchdarkly.flags   → key="new-upload-flow" rollout=85%
  github.commits       → "feat: chunked transfer" by Bimal-ray99
  slack.messages       → "@oncall upload broken for enterprise"
       │
       ▼ Real rows injected into Gemini prompt
         (ranked by keyword relevance to question)
       │
       ▼
Gemini 2.5 Flash — structured JSON output:
  summary, root_cause, who_caused, source_commit,
  affected_component, fix_steps[], confidence
```

Every sentence Gemini writes has a Coral row behind it.

---

## Features in the demo

**Chat + Analysis**
Ask a question in plain English. SSE stream shows Coral sources connecting in real time, then structured AI output appears: dark summary banner, attribution (who + which commit), root cause, numbered fix steps.

**Incident Timeline**
Real Sentry errors from Coral, classified by error type — STORAGE FAILURE, LOCK TIMEOUT, DATA CORRUPTION, VALIDATION ERROR, NULL REFERENCE. Severity rails (red/yellow/blue), source chips, animated fade-in.

**Remediation Panel**
Three real API calls:
- LaunchDarkly: PATCH flag → turnFlagOff
- GitHub: Gemini generates a code fix → commits to branch → opens draft PR → Gemini reviews the diff → UI shows verdict + risk score + per-finding breakdown
- Slack: posts structured incident update to #incidents

**Deep Diagnosis**
Causal JOIN finds the commit closest to the flag enable time. Shows commit SHA, author, expandable diff, and 3 Gemini-generated fix hints.

**Org Pulse Feed**
Rotating insights from Coral: flag changes correlated with error spikes, MRR signals, deploy activity.

**Coral Activity Log**
Every SQL query that ran — source, SQL text, row count, duration. Shows exactly what Coral is doing.

**Autopilot**
Polls Coral every 15s. On anomaly: runs full analysis, then in parallel disables the flag, opens a revert PR, posts to Slack. UI shows "Auto-remediated in 47s" when done.

Any MCP-compatible agent (Claude Desktop, Cursor) can call these directly.

```bash
curl -X POST http://localhost:4000/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"query_incident_status","arguments":{}}}'
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser — Next.js                                           │
│                                                              │
│  ChatInterface  IncidentTimeline  RemediationPanel           │
│  DeepDiagnosisPanel  OrgPulseFeed  CoralActivityPanel        │
└──────────────────────┬───────────────────────────────────────┘
                       │  SSE + REST
┌──────────────────────▼───────────────────────────────────────┐
│  Backend — Express + TypeScript                              │
│                                                              │
│  /api/pulse/stream    SSE analysis (Coral + Gemini)          │
│  /api/autopilot       zero-touch detection + remediation     │
│  /api/remediation/*   LD rollback · GitHub PR-fix · Slack    │
│  /api/diagnosis       deep diagnosis (causal JOIN)           │
│  /mcp                 MCP server (2 tools)                   │
│                                                              │
│  Gemini 2.5 Flash:                                           │
│    analyze() · generateCodeFix() · reviewPRDiff()            │
└──────────────────────┬───────────────────────────────────────┘
                       │  coral sql --format json "SQL"
┌──────────────────────▼───────────────────────────────────────┐
│  Coral                                                       │
│  sentry · launchdarkly · github · slack · stripe · intercom  │
└──────────────────────────────────────────────────────────────┘
                       │  real API calls
           ┌───────────┼───────────┐
       GitHub API   LD API    Slack Webhook
```

---

## Running it

### Prerequisites

- Node.js 18+
- Coral CLI installed and authenticated
- Coral sources connected: `sentry`, `launchdarkly`, `github`, `slack`

### Victim service

```bash
cd pulseiq-victim-service
cp .env.example .env   # set LD_SDK_KEY, SENTRY_DSN
npm install && npm start
# :4001

curl -X POST http://localhost:4001/flag/enable   # start errors
curl -X POST http://localhost:4001/blast          # 50 uploads → ~40 Sentry errors
curl -X POST http://localhost:4001/reset          # disable flag + bulk-resolve Sentry
```

### Backend

```bash
cd backend
cp .env.example .env
npm install && npm run dev
# :4000
```

### Frontend

```bash
cd frontend
npm install && npm run dev
# :3000
```

---

## Environment variables

**backend/.env**

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Required for live AI — falls back to seed data if unset |
| `GITHUB_TOKEN` | `repo` scope — needed for PR generation |
| `GITHUB_OWNER` | GitHub username / org |
| `GITHUB_REPO` | Repo to commit fixes to |
| `LAUNCHDARKLY_TOKEN` | Write access — needed for flag rollback |
| `SLACK_WEBHOOK_URL` | Incoming webhook for #incidents |

**pulseiq-victim-service/.env**

| Variable | Purpose |
|----------|---------|
| `LD_SDK_KEY` | LaunchDarkly server SDK key |
| `LD_API_TOKEN` | LD API token for flag toggle |
| `SENTRY_DSN` | Sentry DSN for error capture |
| `SENTRY_AUTH_TOKEN` | Needed for `/reset` bulk-resolve |
| `SENTRY_ORG` | Sentry organisation slug |
| `SENTRY_PROJECT` | Sentry project slug |

---

## Custom Coral source spec

`coral-specs/vercel_deployments.yaml` adds Vercel deployments as a Coral source. Submitted for the custom source spec bounty.

```sql
SELECT v.git_sha, v.created_at, COUNT(s.title) as errors_after_deploy
FROM vercel_deployments.deployments v
JOIN sentry.issues s
  ON s.first_seen BETWEEN v.created_at AND v.created_at + INTERVAL '1 hour'
WHERE v.target = 'production'
ORDER BY errors_after_deploy DESC
LIMIT 5
```

---

## Tech

- **Frontend**: Next.js, Tailwind CSS v4
- **Backend**: Express, TypeScript
- **AI**: Gemini 2.5 Flash — structured JSON output, temp 0.4
- **Query layer**: Coral — cross-source SQL via CLI
- **Streaming**: Server-Sent Events
- **MCP**: `@modelcontextprotocol/sdk`, StreamableHTTP transport
- **Victim service**: Express + Sentry SDK + LaunchDarkly SDK

---

*Built for the Pirates of the Coral-bean Hackathon · May 2026*
