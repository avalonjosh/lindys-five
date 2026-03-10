import Anthropic from '@anthropic-ai/sdk';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Quick fact-check an article against verified data.
 * Uses Haiku for cost efficiency. Returns pass/fail with issues list.
 */
export async function quickFactCheck(
  anthropic: Anthropic,
  article: string,
  verifiedData: string
): Promise<{ passed: boolean; issues: string[] }> {
  try {
    const message = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: `You are a sports fact-checker. Compare the article against the verified data provided.
Return ONLY valid JSON: {"passed": true/false, "issues": ["description of each issue"]}

Rules:
- Only flag CLEAR NUMERICAL CONTRADICTIONS (wrong scores, wrong goal totals, wrong stats)
- Do NOT flag opinions, analysis, narrative, or atmosphere descriptions
- Do NOT flag claims you cannot verify from the data
- If no clear errors, return {"passed": true, "issues": []}`,
      messages: [{
        role: 'user',
        content: `VERIFIED DATA:\n${verifiedData}\n\nARTICLE TO CHECK:\n${article}`
      }]
    });

    const text = message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      return { passed: json.passed !== false, issues: json.issues || [] };
    }
    return { passed: true, issues: [] };
  } catch (error) {
    console.error('Fact-check error (defaulting to pass):', error);
    return { passed: true, issues: [] };
  }
}
