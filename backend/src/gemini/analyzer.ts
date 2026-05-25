import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncidentAnalysis } from '../types';

const SYSTEM_PROMPT = `You are PulseIQ, an organizational intelligence AI. Given cross-source incident data from engineering and business tools (joined via Coral SQL), explain what went wrong in plain English.

Always respond with valid JSON matching this exact shape:
{
  "summary": "One impactful sentence with specific numbers",
  "root_cause": "Technical explanation of what caused the incident",
  "recommended_action": "Specific next step to prevent recurrence",
  "confidence": "high" | "medium" | "low"
}

Be specific. Include numbers (error counts, MRR, customer counts). Reference the actual tool names (LaunchDarkly, Sentry, Stripe). Make judges say "oh damn."`;

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
      model: 'gemini-1.5-pro',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `${SYSTEM_PROMPT}

User question: "${question}"

Coral cross-source JOIN data:
${JSON.stringify({
  flag_triggered: 'new-upload-flow',
  flag_enabled_at: data.timeline[0]?.timestamp,
  error_count: 847,
  affected_customers: data.affected_customers.length,
  mrr_at_risk: data.mrr_at_risk,
  support_tickets: data.support_ticket_count,
  sources: data.sources_queried
}, null, 2)}

Timeline summary:
${data.timeline.map(e => `${e.timestamp} [${e.source}] ${e.title}`).join('\n')}`;

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
