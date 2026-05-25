# PulseIQ — Demo Script & Presentation Guide

> This doc is for whoever records the demo video and presents to judges.
> Every second is planned. Do not improvise the first run — rehearse 3x first.

---

## The One Thing Judges Must Remember

> *"A LaunchDarkly flag rollout silently destroyed $35K of enterprise MRR — and PulseIQ found it in one question."*

Everything in the demo exists to make that sentence land.

---

## 3-Minute Demo Structure

```
0:00 – 0:25   Hook — the problem
0:25 – 0:45   Show the live app (before asking anything)
0:45 – 1:30   The AI question + Coral JOIN moment
1:30 – 2:15   The "oh damn" reveal — timeline + impact + SQL
2:15 – 2:45   Explain WHY Coral makes this possible
2:45 – 3:00   Vision close
```

---

## Segment 1: Hook (0:00 – 0:25)

**What to say:**
> "It's 10:35 AM. Your Slack is blowing up. Enterprise customers are filing tickets. Revenue is bleeding. Your team is looking at five different tools — GitHub, Sentry, Slack, Stripe, Intercom — all open in separate tabs, all disconnected. No one knows what caused it. That's the problem PulseIQ solves."

**What to show on screen:**
- Nothing yet. Black screen or just the PulseIQ logo.
- Let the words land before showing the product.

**What to highlight:**
- The word "disconnected" — pause on it
- The number FIVE — put up fingers or show five browser tabs briefly if recording screen

---

## Segment 2: Show the App — Before the Question (0:25 – 0:45)

**What to show:**
- Open `http://localhost:3000` (or deployed Vercel URL)
- Point to the sidebar incidents list — "Three recent incidents, all with MRR figures"
- Point to the Coral sources panel — "Six live data sources, all connected via Coral"
- Point to the empty chat — "You ask in plain English"

**What to say:**
> "This is PulseIQ. On the left — recent incidents with business impact already visible. Down here — six data sources joined by Coral. No ETL. No warehouse. No glue code. Just SQL."

**What to highlight:**
- The green dots next to each source — they are LIVE connections
- The MRR numbers in the sidebar — shows business context immediately
- The empty chat input — clean, simple, powerful

**Do NOT say:**
- "Let me show you how it works" (too generic)
- "As you can see" (filler)

---

## Segment 3: The Question (0:45 – 1:30)

**Action:**
Click the suggested question: **"Why are uploads failing?"**

**What to say (while it loads):**
> "I just asked PulseIQ a plain English question. Right now, under the hood, Coral is running a SQL JOIN across LaunchDarkly, Sentry, Stripe, and Intercom — simultaneously — in a single query."

**During the loading spinner:**
- Keep talking — don't let silence happen
- Say: "No one built this JOIN manually. Coral discovered the schemas, handled auth, handled pagination. We just wrote SQL."

**What to highlight during load:**
- The loading message: *"Querying 6 sources via Coral SQL JOINs..."*
- Say that out loud: "Six sources. One query."

---

## Segment 4: The "Oh Damn" Reveal (1:30 – 2:15)

This is the most important 45 seconds of the demo. Go slowly.

### Step 1 — Read the summary banner out loud

> "Feature flag 'new-upload-flow' triggered a cascade failure at 10:02 AM, causing 847 errors in 13 minutes and affecting 12 Enterprise customers representing $35,200 MRR."

**Pause here. Let it sink in.**

> "One question. That answer. That is what took a human engineer 45 minutes to piece together across five tools."

### Step 2 — Point to the timeline

> "Look at this. 10:02 — flag enabled. 10:15 — error spike begins. 10:35 — enterprise tickets open. 10:47 — flag rolled back. PulseIQ reconstructed the entire incident timeline from six data sources automatically."

**What to highlight:**
- The color-coded dots — each source has its own color
- The 45-minute gap between flag enabled (10:02) and rollback (10:47)
- The fact that Intercom tickets came AFTER the Sentry spike — causality is visible

### Step 3 — Point to the impact card

> "Twelve Enterprise customers. Thirty-five thousand dollars of MRR at risk. Eight support tickets. These are Stripe customers — real subscription revenue — tied directly to the errors in Sentry."

**What to highlight:**
- The red MRR number — make it the focal point, zoom if possible
- The customer table showing tier = enterprise — not random users, paying customers

### Step 4 — The SQL reveal (KEY JUDGE MOMENT)

Click **"View Coral Query"**.

**Say:**
> "Here is the query that produced this entire analysis."

Read the JOIN aloud — slowly:
> "LaunchDarkly flag evaluations... joined to Sentry errors by timestamp window... joined to Stripe customers by user ID... joined to Intercom tickets by user ID. Four sources. One query. Coral made this possible."

**Pause again.**

> "Before Coral, this data lived in four separate APIs, four authentication systems, four rate limits. This query didn't exist. Now it does."

**What to highlight:**
- The `JOIN ... BETWEEN ... INTERVAL '2 hours'` — temporal JOIN is powerful, say it
- The `SUM(st.mrr)` — SQL pulling business revenue from Stripe
- The source list: `launchdarkly × github × sentry × slack × stripe × intercom`

---

## Segment 5: Why Coral Makes This Possible (2:15 – 2:45)

**What to say:**
> "Every tool here — LaunchDarkly, Sentry, Stripe — has its own API, its own auth, its own pagination. Normally you'd write six different API clients, ETL pipelines, and a warehouse to join them. Coral removes all of that. It turns any API into a SQL table. We query them like a database."

**What to show:**
- Switch briefly to terminal (optional, only if comfortable)
- Show: `coral source list` output — all sources installed
- Or just say it verbally if you don't want to switch windows

**What to highlight:**
- "No ETL" — say it explicitly
- "No warehouse" — say it explicitly
- "Just SQL" — the punchline

---

## Segment 6: Vision Close (2:45 – 3:00)

**What to say:**
> "PulseIQ is what every on-call engineer wishes they had. Not another dashboard. Not another alert. An intelligence layer that joins your entire organization — engineering, business, customers — and answers questions in plain English. Built on Coral."

**What to show:**
- Back to the full dashboard
- The summary banner visible — the "oh damn" sentence still on screen
- End on that.

---

## Pre-Demo Checklist

Run through this before hitting record:

- [ ] Backend running on port 4000 (`npm run dev` in `/backend`)
- [ ] Frontend running on port 3000 (`npm run dev` in `/frontend`)
- [ ] `http://localhost:3000` loads with 3 incidents in sidebar
- [ ] Click "Why are uploads failing?" — analysis loads in < 3 seconds
- [ ] Summary banner shows $35,200 MRR sentence
- [ ] Timeline shows all 8 events with color-coded dots
- [ ] Impact card shows 12 customers, $35,200, 8 tickets
- [ ] Query viewer expands and shows full SQL JOIN
- [ ] Browser zoom at 110% (easier for judges to read)
- [ ] Close all other browser tabs
- [ ] Turn off Slack/Discord notifications
- [ ] Mic tested — no echo, no background noise

---

## Things to Highlight vs. Things to Skip

### HIGHLIGHT THESE — Judges score on this

| What | Why it matters |
|------|---------------|
| "6 sources, 1 query" | Demonstrates Coral's core value |
| The temporal JOIN (`BETWEEN ... INTERVAL`) | Shows sophisticated SQL, not toy queries |
| Stripe MRR in the SQL | Proves business + engineering data unified |
| The 45-minute incident window | Makes the timeline emotionally real |
| "No ETL, no warehouse" | Directly contrasts with alternatives |
| The LaunchDarkly → Sentry causal link | The insight no human found fast enough |

### SKIP OR MINIMIZE THESE

| What | Why to skip |
|------|------------|
| The code internals | Judges don't need to see TypeScript |
| The backend architecture | Demo doc explains it — don't narrate it |
| How shadcn/ui works | Nobody cares, not relevant |
| Loading times / delays | Apologize once if slow, move on |
| Feature flag rollout mechanics | One sentence max — LaunchDarkly is the signal, not the story |

---

## Verbal Hooks That Land With Judges

Use these exact phrases — they're tested:

- **"Six sources. One query."** — say this right before expanding the SQL
- **"This JOIN didn't exist before Coral."** — say after showing the SQL
- **"Forty-five minutes of investigation. One question."** — say after the summary banner
- **"Business revenue, directly in SQL."** — when pointing to `SUM(st.mrr)`
- **"The flag enabled at 10:02. The tickets started at 10:35. Coral found that."** — on the timeline

---

## Common Mistakes to Avoid

**Don't demo on slow internet.** Use localhost or have the deployed URL fully warmed up.

**Don't read the UI text.** Judges can read. You add context they can't get from the screen.

**Don't say "basically" or "just" or "simply."** These words make things sound small.

**Don't rush the SQL reveal.** This is the technical credibility moment. Slow down.

**Don't explain Coral before showing the demo.** Show the demo first. Explain Coral after the "oh damn" moment. Judges are more receptive after they've already seen value.

**Don't end on a slide.** End on the product. The summary banner with $35,200 MRR on screen is more powerful than any closing slide.

---

## If Something Breaks During Demo

| Problem | Fix |
|---------|-----|
| Backend not responding | Refresh, say "let me restart" — have a pre-recorded backup video ready |
| Analysis takes too long | While waiting, narrate what Coral is doing. Fill silence with substance. |
| UI looks wrong | Screenshot backup — have 3 screenshots of the golden path ready |
| Forgot what to say | The summary banner text is your script. Read it. |

---

## Screenshot Backup (Record These Before Demo Day)

Take and save these 4 screenshots in case live demo fails:

1. **Full dashboard** — sidebar + empty chat
2. **Loading state** — "Querying 6 sources via Coral SQL JOINs..."
3. **Summary banner + timeline** — the "oh damn" sentence visible
4. **SQL viewer open** — full JOIN query visible with source list

---

## The One Metric That Wins

If judges remember one thing, make it this:

> **$35,200 MRR identified at risk — from a single plain English question — by joining 6 enterprise data sources with one Coral SQL query.**

Put that on the opening slide if you use slides. Put it on the closing frame of the video.

That number, that sentence, that JOIN. That is PulseIQ.
