import { Router, Request, Response } from 'express';

export const remediationRouter = Router();

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
        // PR exists for this branch — create new one with incremented title
        const baseTitle = title || 'fix: revert breaking change (PulseIQ auto-remediation)';
        const allPrsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=50`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );
        const allPrs = await allPrsRes.json() as Record<string, unknown>[];
        // Find highest numeric suffix among PRs with same base title
        const stripped = baseTitle.replace(/\s*\(\d+\)$/, '');
        let maxN = 1;
        if (Array.isArray(allPrs)) {
          for (const pr of allPrs) {
            const t = String(pr.title ?? '');
            if (t.startsWith(stripped)) {
              const m = t.match(/\((\d+)\)$/);
              if (m) maxN = Math.max(maxN, parseInt(m[1]));
              else maxN = Math.max(maxN, 1);
            }
          }
        }
        const newTitle = `${stripped} (${maxN + 1})`;
        const newHeadBranch = `${(head || process.env.GITHUB_HEAD_BRANCH || 'fix/revert-upload-bug')}-${maxN + 1}`;
        const retryRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle, body, head: newHeadBranch, base: baseBranch, draft: true }),
        });
        const retryData = await retryRes.json() as Record<string, unknown>;
        if (retryRes.ok) {
          return res.json({ success: true, pr_url: retryData.html_url, pr_number: retryData.number });
        }
        // new branch doesn't exist either — fall back to returning the existing PR
        const headBranch = head || process.env.GITHUB_HEAD_BRANCH || 'fix/revert-upload-bug';
        const listRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${headBranch}&state=open`,
          { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );
        const existing = await listRes.json() as Record<string, unknown>[];
        if (Array.isArray(existing) && existing.length > 0) {
          return res.json({ success: true, pr_url: existing[0].html_url, pr_number: existing[0].number, already_existed: true });
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
