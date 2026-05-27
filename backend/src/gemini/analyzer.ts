import { GoogleGenerativeAI } from '@google/generative-ai';
import { IncidentAnalysis } from '../types';

const SYSTEM_PROMPT = `You are PulseIQ, an organizational intelligence AI. Given incident data from engineering tools (joined via Coral SQL), explain what happened in plain English.

Currently, we only have LaunchDarkly data. Explain which flag was toggled based on the data. Do NOT mention MRR, Support Tickets, or Sentry errors because they are not integrated yet.

Always respond with valid JSON matching this exact shape:
{
  "summary": "One impactful sentence about the feature flag change",
  "root_cause": "Technical explanation of the flag state",
  "recommended_action": "Specific next step to monitor or revert",
  "confidence": "high" | "medium" | "low"
}`;

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing. Live integration requires Gemini.');
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async analyze(
    question: string,
    data: IncidentAnalysis
  ): Promise<Pick<IncidentAnalysis, 'summary' | 'root_cause' | 'recommended_action' | 'confidence'>> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `${SYSTEM_PROMPT}

User question: "${question}"

Coral query data:
${JSON.stringify(data.timeline, null, 2)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text) as Pick<IncidentAnalysis, 'summary' | 'root_cause' | 'recommended_action' | 'confidence'>;
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }
  }
}
