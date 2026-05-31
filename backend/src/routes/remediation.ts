import { Router, Request, Response } from 'express';
import { GeminiAnalyzer } from '../gemini/analyzer';

export const remediationRouter = Router();
const gemini = new GeminiAnalyzer();

// POST /api/remediation/github-pr
remediationRouter.post('/github-pr', async (req: Request, res: Response) => {
  const { title, body, head, base } = req.body as {
    title: string;
    body: string;
    head: string;
    base: string;
  };

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const baseBranch = base || process.env.GITHUB_BASE_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return res.status(503).json({
      error: 'GitHub not configured',
      hint: 'Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in .env'
    });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title || 'fix: revert breaking change (PulseIQ auto-remediation)',
        body,
        head: head || process.env.GITHUB_HEAD_BRANCH || 'fix/revert-upload-bug',
        base: baseBranch,
        draft: true,
      }),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      // PR already exists for this head branch — find and return it
      const isAlreadyExists = response.status === 422 &&
        JSON.stringify(data).toLowerCase().includes('pull request already exists');

      if (isAlreadyExists) {
        const baseHeadBranch = head || process.env.GITHUB_HEAD_BRANCH || 'fix/revert-upload-bug';
        const baseTitle = title || 'fix: revert breaking change (PulseIQ auto-remediation)';
        const stripped = baseTitle.replace(/\s*\(\d+\)$/, '');

        // Find highest existing increment
        const allPrsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=50`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );
        const allPrs = await allPrsRes.json() as Record<string, unknown>[];
        let maxN = 1;
        if (Array.isArray(allPrs)) {
          for (const pr of allPrs) {
            const t = String(pr.title ?? '');
            if (t.startsWith(stripped)) {
              const m = t.match(/\((\d+)\)$/);
              if (m) maxN = Math.max(maxN, parseInt(m[1]));
            }
          }
        }
        const newN = maxN + 1;
        const newBranch = `${baseHeadBranch}-${newN}`;
        const newTitle = `${stripped} (${newN})`;

        // Get base branch SHA to create new branch from
        const refRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );
        const refData = await refRes.json() as Record<string, unknown>;
        const sha = (refData.object as Record<string, unknown>)?.sha as string;
        if (!sha) {
          return res.status(500).json({ error: 'Could not get base branch SHA to create new branch' });
        }

        // Create new branch
        await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
        });

        // Create PR from new branch
        const newPrRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle, body, head: newBranch, base: baseBranch, draft: true }),
        });
        const newPrData = await newPrRes.json() as Record<string, unknown>;
        if (newPrRes.ok) {
          return res.json({ success: true, pr_url: newPrData.html_url, pr_number: newPrData.number });
        }
      }

      return res.status(response.status).json({
        error: 'GitHub API error',
        details: data
      });
    }

    return res.json({
      success: true,
      pr_url: data.html_url,
      pr_number: data.number,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'GitHub request failed' });
  }
});

// POST /api/remediation/ld-rollback
remediationRouter.post('/ld-rollback', async (req: Request, res: Response) => {
  const { flag_key, comment } = req.body as { flag_key: string; comment?: string };

  const token      = process.env.LAUNCHDARKLY_TOKEN;
  const projectKey = process.env.LD_PROJECT_KEY || 'default';
  const envKey     = process.env.LD_ENVIRONMENT_KEY || 'production';

  if (!token) {
    return res.status(503).json({
      error: 'LaunchDarkly not configured',
      hint: 'Set LAUNCHDARKLY_TOKEN in .env'
    });
  }

  if (!flag_key) {
    return res.status(400).json({ error: 'flag_key required' });
  }

  try {
    const response = await fetch(
      `https://app.launchdarkly.com/api/v2/flags/${projectKey}/${flag_key}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json; domain-model=launchdarkly.semanticpatch',
        },
        body: JSON.stringify({
          environmentKey: envKey,
          instructions: [{ kind: 'turnFlagOff' }],
          comment: comment || 'Emergency rollback via PulseIQ auto-remediation',
        }),
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      return res.status(response.status).json({ error: 'LaunchDarkly API error', details: data });
    }

    return res.json({
      success: true,
      flag: data.key,
      environments: data.environments,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'LaunchDarkly request failed' });
  }
});

// POST /api/remediation/slack-post
remediationRouter.post('/slack-post', async (req: Request, res: Response) => {
  const { message } = req.body as { message: string };

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(503).json({
      error: 'Slack not configured',
      hint: 'Set SLACK_WEBHOOK_URL in .env'
    });
  }

  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Slack webhook error', details: text });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Slack request failed' });
  }
});

// POST /api/remediation/github-pr-with-fix
// Identifies affected file, Gemini generates patch, commits to new branch, creates PR, Gemini reviews PR diff
remediationRouter.post('/github-pr-with-fix', async (req: Request, res: Response) => {
  const {
    root_cause, error_title, affected_component, fix_steps,
    incident_id, who_caused, summary, mrr_at_risk,
  } = req.body as {
    root_cause: string; error_title: string; affected_component: string;
    fix_steps: { step: number; action: string; detail: string }[];
    incident_id: string; who_caused?: string; summary?: string; mrr_at_risk?: number;
  };

  const token      = process.env.GITHUB_TOKEN;
  const owner      = process.env.GITHUB_OWNER;
  const repo       = process.env.GITHUB_REPO;
  const baseBranch = process.env.GITHUB_BASE_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return res.status(503).json({ error: 'GitHub not configured', hint: 'Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in .env' });
  }

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    // ── Step 1: Find target file ────────────────────────────────────────────────
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers: ghHeaders });
    const treeData = await treeRes.json() as { tree?: { path: string; type: string }[] };
    const sourceFiles = (treeData.tree ?? [])
      .filter(f => f.type === 'blob' && /\.(js|ts|py|go|java|rb)$/.test(f.path) && !/node_modules|dist|\.min\./.test(f.path))
      .map(f => f.path);

    // Score files: keyword match against affected_component + error_title
    const keywords = [
      ...(affected_component ?? '').toLowerCase().split(/[-_/ ]/),
      ...(error_title ?? '').toLowerCase().split(/[\s:()]+/).slice(0, 3),
    ].filter(k => k.length > 3);

    const scored = sourceFiles.map(p => ({
      path: p,
      score: keywords.filter(k => p.toLowerCase().includes(k)).length,
    })).sort((a, b) => b.score - a.score);

    const targetPath = scored[0]?.path ?? sourceFiles[0];
    if (!targetPath) return res.status(404).json({ error: 'No source files found in repo' });

    // ── Step 2: Fetch file content ──────────────────────────────────────────────
    const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`, { headers: ghHeaders });
    const fileData = await fileRes.json() as { content?: string; sha?: string; encoding?: string };
    if (!fileData.content || !fileData.sha) return res.status(404).json({ error: `File not found: ${targetPath}` });

    const fileContent = Buffer.from(fileData.content.replace(/\n/g, ''), 'base64').toString('utf8');
    const fileSha = fileData.sha;

    // ── Step 3: Gemini generates fix ───────────────────────────────────────────
    const codeFix = await gemini.generateCodeFix({
      filePath: targetPath, fileContent, rootCause: root_cause,
      errorTitle: error_title, fixSteps: fix_steps ?? [],
    });

    // ── Step 4: Create branch ──────────────────────────────────────────────────
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, { headers: ghHeaders });
    const refData = await refRes.json() as { object?: { sha?: string } };
    const baseSha = refData.object?.sha;
    if (!baseSha) return res.status(500).json({ error: 'Could not resolve base branch SHA' });

    const now = Date.now();
    const branchName = `fix/pulseiq-autofix-${incident_id ?? 'inc'}-${now}`;
    await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST', headers: ghHeaders,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });

    // ── Step 5: Commit fixed file ──────────────────────────────────────────────
    const fixedBase64 = Buffer.from(codeFix.fixedContent, 'utf8').toString('base64');
    const commitMessage = `fix(${targetPath}): ${codeFix.linesChanged[0] ?? 'PulseIQ autofix'}\n\nIncident: ${incident_id}\nRoot cause: ${root_cause?.slice(0, 120)}\nGenerated by PulseIQ`;
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${targetPath}`, {
      method: 'PUT', headers: ghHeaders,
      body: JSON.stringify({ message: commitMessage, content: fixedBase64, sha: fileSha, branch: branchName }),
    });
    if (!commitRes.ok) {
      const err = await commitRes.json() as Record<string, unknown>;
      return res.status(500).json({ error: 'Commit failed', details: err });
    }

    // ── Step 6: Create PR ──────────────────────────────────────────────────────
    const prNow = new Date().toISOString();
    const mrr = mrr_at_risk ? `$${Number(mrr_at_risk).toLocaleString()}` : 'unknown';
    const fixStepsMd = (fix_steps ?? []).map(s => `- [x] **Step ${s.step}: ${s.action}** — ${s.detail}`).join('\n');
    const linesChangedMd = codeFix.linesChanged.map(l => `- ${l}`).join('\n');

    const prBody = `## 🤖 PulseIQ Autofix — ${incident_id ?? 'Incident'}

> Auto-generated fix. **Do not merge without SRE sign-off.**

---

### Incident Metadata

| Field | Value |
|-------|-------|
| Incident ID | \`${incident_id ?? 'unknown'}\` |
| Generated at | \`${prNow}\` |
| MRR at Risk | ${mrr} |
| Affected File | \`${targetPath}\` |
| Caused by | \`${who_caused ?? 'unknown'}\` |

---

### Root Cause

${root_cause}

---

### What Was Changed

${codeFix.explanation}

**Lines modified:**
${linesChangedMd}

---

### Fix Checklist

${fixStepsMd}

---

### Summary

${summary ?? 'See root cause above.'}

---
*Auto-generated by [PulseIQ](https://github.com) · Powered by Coral SQL JOINs + Gemini · ${prNow}*`;

    const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST', headers: ghHeaders,
      body: JSON.stringify({ title: `fix: PulseIQ autofix ${incident_id} — ${targetPath}`, body: prBody, head: branchName, base: baseBranch, draft: true }),
    });
    const prData = await prRes.json() as Record<string, unknown>;
    if (!prRes.ok) return res.status(prRes.status).json({ error: 'PR creation failed', details: prData });

    const prNumber = prData.number as number;
    const prUrl = prData.html_url as string;

    // ── Step 7: Fetch PR diff + Gemini review ──────────────────────────────────
    const diffRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers: ghHeaders });
    const diffFiles = await diffRes.json() as { filename: string; patch?: string }[];
    const diff = diffFiles.map(f => `--- ${f.filename}\n${f.patch ?? ''}`).join('\n\n');

    const prReview = await gemini.reviewPRDiff({ diff, rootCause: root_cause, filePath: targetPath });

    return res.json({
      success: true,
      pr_url: prUrl,
      pr_number: prNumber,
      file_path: targetPath,
      branch: branchName,
      lines_changed: codeFix.linesChanged,
      explanation: codeFix.explanation,
      pr_analysis: prReview,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Autofix failed' });
  }
});
