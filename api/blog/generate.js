import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(req) {
  const token = req.cookies?.admin_token;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Sports journalism system prompt
const SYSTEM_PROMPT = `You are an experienced sports journalist writing for "Lindy's Five", a Buffalo sports blog covering the Sabres (NHL) and Bills (NFL).

Your writing style:
- Engaging and conversational, like a knowledgeable fan talking to other fans
- Analytical with specific stats and observations when available
- Balanced between optimism and realistic assessment
- Use vivid, descriptive language for game action
- Include relevant context (standings, streaks, historical comparisons)
- Reference specific players, plays, and moments when possible

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for emphasis on key stats or player names
- Keep paragraphs concise (3-4 sentences max)
- Include a compelling opening hook
- End with forward-looking thoughts or questions for readers

Team context:
- Sabres: NHL team in Buffalo, NY. Colors: blue and gold. Arena: KeyBank Center. Key players include Tage Thompson, Rasmus Dahlin, Owen Power, JJ Peterka, Dylan Cozens.
- Bills: NFL team in Buffalo, NY. Colors: red, blue, white. Stadium: Highmark Stadium. Key players include Josh Allen, Stefon Diggs, Von Miller.

IMPORTANT: Write ORIGINAL content only. Never copy from other sources. Create your own narrative and analysis based on the facts provided.`;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idea, team, title, researchEnabled = false, allowedDomains } = req.body;

  // Validate required fields
  if (!idea || !team) {
    return res.status(400).json({
      error: 'Missing required fields: idea and team are required',
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build the user prompt
    const teamName = team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills';
    const userPrompt = `Write an article for the ${teamName} based on the following idea:

${idea}

${title ? `Suggested title: "${title}"` : 'Please also suggest a compelling, SEO-friendly title.'}

Please provide your response in this exact format:
TITLE: [Your title here]
META: [A brief meta description for SEO, max 160 characters]
---
[Article content in Markdown format]

The article should be 400-800 words and follow the style guidelines provided.`;

    // Configure tools for web search if enabled
    // Note: Using minimal config - domain filtering can be added if basic search works
    const tools = researchEnabled
      ? [
          {
            type: 'web_search_20250305',
          },
        ]
      : undefined;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content from the response
    const textContent = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    const titleMatch = textContent.match(/^TITLE:\s*(.+)$/m);
    const metaMatch = textContent.match(/^META:\s*(.+)$/m);
    const contentSplit = textContent.split('---\n');

    const generatedTitle = titleMatch ? titleMatch[1].trim() : title || 'Untitled Article';
    const metaDescription = metaMatch ? metaMatch[1].trim().slice(0, 160) : '';
    const content =
      contentSplit.length > 1 ? contentSplit.slice(1).join('---\n').trim() : textContent;

    return res.status(200).json({
      success: true,
      content,
      title: generatedTitle,
      metaDescription,
      model: 'claude-sonnet-4-20250514',
    });
  } catch (error) {
    console.error('Error generating article:', error);

    // Handle specific Anthropic errors
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.',
        details: error.message,
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request to AI service.',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to generate article',
      details: error.message,
    });
  }
}
