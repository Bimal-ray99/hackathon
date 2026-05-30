import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const diagnosisRouter = Router();
const coral = new CoralClient();

interface DiagnosisFile {
  filename: string;
  additions: number;
  deletions: number;
  patch: string;
}

interface DiagnosisResult {
  sha: string;
  message: string;
  author: string;
  date: string;
  files: DiagnosisFile[];
  hints: string[];
  gemini_used: boolean;
  source: 'live' | 'seed';
}

const SEED_RESULT: DiagnosisResult = {
  sha: 'a3f9c21',
  message: 'feat: new upload flow with chunked transfer',
  author: 'sarah.chen',
  date: '2024-05-28T14:32:00Z',
  files: [
    {
      filename: 'src/upload/handler.ts',
      additions: 23,
      deletions: 4,
      patch: [
        '@@ -44,10 +44,12 @@ export async function processUpload(file: File) {',
        '-  const stream = file.getStream();',
        '+  const stream = file.stream();',
        '+  if (!stream) throw new Error("stream undefined");',
        '   const chunks = [];',
        '-  for await (const chunk of stream) {',
        '+  for await (const chunk of stream as AsyncIterable<Uint8Array>) {',
        '     chunks.push(chunk);',
        '   }',
        '   await processChunks(chunks);',
      ].join('\n'),
    },
    {
      filename: 'src/upload/chunks.ts',
      additions: 8,
      deletions: 2,
      patch: [
        '@@ -12,6 +12,10 @@ export async function splitChunks(data: ReadableStream) {',
        '-  const reader = data.getReader();',
        '+  const reader = data?.getReader();',
        '+  if (!reader) {',
        '+    throw new Error("stream is not defined");',
        '+  }',
        '   const chunks = [];',
      ].join('\n'),
    },
  ],
  hints: [
    '`file.stream()` returns `undefined` for files >10MB in Safari and older Chromium. The original `file.getStream()` was a non-standard but widely-supported alias. Fix: add null check — `const stream = file.stream() ?? file.getStream();`',
    'Immediate fix: `const stream = file.stream(); if (!stream) { return res.status(413).json({ error: "Streaming not supported for this file size" }); }`',
    'Long-term: migrate Enterprise tier uploads to multipart (S3-style). Files >5MB should never use streaming from the browser — chunk server-side instead.',
  ],
  gemini_used: false,
  source: 'seed',
};

// POST /api/diagnosis
diagnosisRouter.post('/', async (req: Request, res: Response) => {
  const { flag_key = 'new-upload-flow', seed = true } = req.body as {
    flag_key?: string;
    seed?: boolean;
  };

  if (seed) {
    return res.json(SEED_RESULT);
  }

  // Step 1: Coral causal JOIN to find the commit deployed with this flag
  let commitSha = 'a3f9c21';
  let commitMessage = SEED_RESULT.message;
  let commitAuthor = SEED_RESULT.author;
  let commitDate = SEED_RESULT.date;

  try {
    const rows = await coral.query(
      `SELECT g.sha, g.message, g.commit__author__name as author, g.commit__author__date as ts
       FROM github.commits g
       JOIN launchdarkly.feature_flags l
         ON g.commit__author__date >= l.creation_date - '30 minutes'::interval
        AND g.commit__author__date <= l.creation_date + '10 minutes'::interval
       WHERE l.key = '${flag_key}'
       ORDER BY g.commit__author__date DESC
       LIMIT 1`
    );
    if (rows.length > 0) {
      const r = rows[0] as Record<string, unknown>;
      commitSha = String(r.sha ?? commitSha);
      commitMessage = String(r.message ?? commitMessage);
      commitAuthor = String(r.author ?? commitAuthor);
      commitDate = String(r.ts ?? commitDate);
    }
  } catch { /* use seed sha */ }

  // Step 2: Fetch git diff from GitHub API
  let files: DiagnosisFile[] = SEED_RESULT.files;
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (token && owner && repo) {
    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );
      if (ghRes.ok) {
        const data = await ghRes.json() as { files?: { filename: string; additions: number; deletions: number; patch?: string }[] };
        if (data.files && data.files.length > 0) {
          files = data.files.slice(0, 5).map(f => ({
            filename: f.filename,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch ?? '',
          }));
        }
      }
    } catch { /* use seed files */ }
  }

  // Step 3: Gemini code-level analysis
  let hints = SEED_RESULT.hints;
  let geminiUsed = false;

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && files.length > 0) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });

      const diffText = files.map(f =>
        `File: ${f.filename} (+${f.additions}/-${f.deletions})\n${f.patch}`
      ).join('\n\n');

      const prompt = `You are a senior SRE analyzing a production incident.

The following git diff was deployed immediately before a production error spike.
Flag: ${flag_key}
Commit: ${commitSha} by ${commitAuthor}

Diff:
${diffText}

Identify the exact line(s) that caused the issue and provide 3 specific, actionable fix steps.
Be concrete — reference actual line content from the diff.

Respond with valid JSON:
{
  "hints": ["hint 1 citing exact code", "hint 2 with immediate fix", "hint 3 long-term recommendation"]
}`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text()) as { hints: string[] };
      if (parsed.hints && parsed.hints.length > 0) {
        hints = parsed.hints;
        geminiUsed = true;
      }
    } catch { /* use seed hints */ }
  }

  return res.json({
    sha: commitSha,
    message: commitMessage,
    author: commitAuthor,
    date: commitDate,
    files,
    hints,
    gemini_used: geminiUsed,
    source: token && owner && repo ? 'live' : 'seed',
  } satisfies DiagnosisResult);
});
