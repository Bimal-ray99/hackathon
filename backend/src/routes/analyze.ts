import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GeminiAnalyzer } from '../gemini/analyzer';
import { AnalyzeRequest } from '../types';

export const analyzeRouter = Router();
const coral = new CoralClient();
const gemini = new GeminiAnalyzer();

analyzeRouter.post('/', async (req: Request, res: Response) => {
  const { question, incident_id = 'inc-001' } = req.body as AnalyzeRequest;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const coralData = await coral.runIncidentQuery(incident_id);
    const aiResult = await gemini.analyze(question, coralData);

    return res.json({
      ...coralData,
      ...aiResult,
      question
    });
  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: 'Analysis failed' });
  }
});
