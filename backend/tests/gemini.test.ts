import { GeminiAnalyzer } from '../src/gemini/analyzer';
import { SEED_ANALYSIS } from '../src/seed/data';

describe('GeminiAnalyzer', () => {
  it('returns structured analysis with required fields', async () => {
    const analyzer = new GeminiAnalyzer();
    const result = await analyzer.analyze(
      'Why are uploads failing?',
      SEED_ANALYSIS
    );
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('root_cause');
    expect(result).toHaveProperty('recommended_action');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(20);
  });
});
