import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncidentAnalysis } from '../types';

interface RagContext {
  stackTraces: { title: string; level?: string; project?: string }[];
  slackMessages: { text: string; ts?: string }[];
  flagDetails: { key: string; description?: string; name?: string }[];
  commitMessages: { message: string; author: string }[];
}

const SYSTEM_PROMPT = `You are PulseIQ, an organizational intelligence AI. You analyze cross-source incident data joined via Coral SQL across engineering and business tools.

Given real data retrieved via Coral from multiple sources, explain what went wrong with surgical precision.

Rules:
- Cite specific data: exact error text, flag names, commit messages, Slack quotes from the rows provided.
- Connect cause to effect: "Flag X enabled → sarah.chen's commit changed .getStream() to .stream() → TypeError in upload/handler.ts → 847 Enterprise errors"
- Every claim must be traceable to a specific Coral row in the data below.
- Sound like a senior SRE explaining to a CEO.

Always respond with valid JSON:
{
  "summary": "One powerful sentence with specific artifact names and cause-effect chain",
  "root_cause": "2-3 sentences: cite exact error title, exact flag key, exact commit message",
  "recommended_action": "3 specific steps citing actual artifacts from the data",
  "confidence": "high" | "medium" | "low"
}`;

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI | null;
  private useSeed: boolean;

  constructor() {
    this.useSeed = !process.env.GEMINI_API_KEY;
    this.genAI = process.env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      : null;
  }

  async analyze(
    question: string,
    data: IncidentAnalysis,
    ragContext?: RagContext
  ): Promise<Pick<IncidentAnalysis, 'summary' | 'root_cause' | 'recommended_action' | 'confidence'>> {
    if (this.useSeed || !this.genAI) {
      // No Gemini key — synthesize from RAG context directly
      if (ragContext && ragContext.stackTraces.length > 0) {
        const topError = ragContext.stackTraces[0];
        const flagMention = ragContext.flagDetails[0]?.key ?? 'unknown flag';
        const commitMention = ragContext.commitMessages[0]?.message ?? '';
        return {
          summary: `${topError.title} — level: ${topError.level ?? 'error'}, project: ${topError.project ?? 'unknown'} (add GEMINI_API_KEY for AI analysis)`,
          root_cause: `Sentry reports: "${topError.title}" (${topError.level ?? 'error'} in ${topError.project ?? 'unknown'}). Active flag: ${flagMention}. ${commitMention ? `Recent commit: "${commitMention}".` : ''}`,
          recommended_action: `1. Investigate ${topError.culprit || 'error location'}\n2. Check if flag "${flagMention}" correlates with error spike\n3. Add GEMINI_API_KEY to backend .env for AI-powered analysis`,
          confidence: 'medium'
        };
      }
      return {
        summary: data.summary || 'No Coral data available — check source connections',
        root_cause: data.root_cause || 'Connect Sentry/LaunchDarkly via Coral to see root cause',
        recommended_action: data.recommended_action || 'Run: coral connect sentry',
        confidence: data.confidence || 'low'
      };
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    const timelineSummary = data.timeline
      .map(e => `[${e.source.toUpperCase()}] ${e.timestamp}: ${e.title} — ${e.description}`)
      .join('\n');

    const ragSection = ragContext ? `
CORAL RAG — ACTUAL DATA RETRIEVED (cite these rows directly):

SENTRY STACK TRACES:
${ragContext.stackTraces.map(r => `  • [${r.level ?? 'error'}] ${r.title} (project: ${r.project ?? 'unknown'})`).join('\n')}

SLACK #incidents MESSAGES:
${ragContext.slackMessages.map(r => `  • "${r.text}"`).join('\n')}

LAUNCHDARKLY ACTIVE FLAGS:
${ragContext.flagDetails.map(r => `  • ${r.key}: ${r.description || r.name || ''}`).join('\n')}

RECENT GITHUB COMMITS:
${ragContext.commitMessages.map(r => `  • "${r.message}" by ${r.author}`).join('\n')}

INSTRUCTION: Every sentence in root_cause and recommended_action MUST cite specific text from the rows above.
` : '';

    const prompt = `${SYSTEM_PROMPT}
${ragSection}
User question: "${question}"

Sources queried via Coral: ${data.sources_queried.join(', ')}

Timeline (${data.timeline.length} events):
${timelineSummary}

Coral SQL:
${data.coral_query}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text) as Pick<IncidentAnalysis, 'summary' | 'root_cause' | 'recommended_action' | 'confidence'>;
    } catch {
      return {
        summary: data.summary,
        root_cause: data.root_cause,
        recommended_action: data.recommended_action,
        confidence: 'medium'
      };
    }
  }
}
