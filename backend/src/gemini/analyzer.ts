import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncidentAnalysis } from '../types';

const SYSTEM_PROMPT = `You are PulseIQ, an organizational intelligence AI. You analyze cross-source incident data joined via Coral SQL across engineering and business tools.

Given timeline data from multiple sources (LaunchDarkly, GitHub, Sentry, Slack, Stripe, Intercom), explain what went wrong in plain English.

Rules:
- Be specific. Use exact timestamps, error counts, flag names from the data.
- Connect cause to effect: "Flag X enabled at T1 → errors spiked at T2 → tickets opened at T3"
- If data shows flag changes near error spikes, that IS the root cause.
- Sound like a senior SRE explaining to a CEO, not a bot.

Always respond with valid JSON:
{
  "summary": "One powerful sentence with specific numbers and cause-effect",
  "root_cause": "2-3 sentences: what changed, what broke, why it broke",
  "recommended_action": "Specific actionable next step",
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
    data: IncidentAnalysis
  ): Promise<Pick<IncidentAnalysis, 'summary' | 'root_cause' | 'recommended_action' | 'confidence'>> {
    if (this.useSeed || !this.genAI) {
      return {
        summary: data.summary,
        root_cause: data.root_cause,
        recommended_action: data.recommended_action,
        confidence: data.confidence
      };
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const timelineSummary = data.timeline
      .map(e => `[${e.source.toUpperCase()}] ${e.timestamp}: ${e.title} — ${e.description}`)
      .join('\n');

    const prompt = `${SYSTEM_PROMPT}

User question: "${question}"

Sources queried via Coral: ${data.sources_queried.join(', ')}

Timeline (${data.timeline.length} events across ${data.sources_queried.length} sources):
${timelineSummary}

Coral SQL query used:
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
