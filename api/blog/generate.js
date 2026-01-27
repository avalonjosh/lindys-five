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
const SYSTEM_PROMPT = `You are a professional sports journalist writing for "Lindy's Five", a Buffalo sports blog covering the Sabres (NHL) and Bills (NFL).

Your writing style:
- Professional sports journalism tone - authoritative yet accessible
- Analytical with specific stats and observations to support your points
- Objective analysis with measured opinions backed by evidence
- When expressing opinions, frame them professionally (e.g., "the data suggests...", "it's worth noting that...", "this raises questions about...")
- Maintain journalistic integrity - present facts first, opinions second
- Use clear, descriptive language for game action without hyperbole
- Include relevant context (standings, streaks, historical comparisons)
- Reference specific players, plays, and moments when applicable
- Avoid snark, hot takes, or overly casual language
- Avoid clickbait-style phrasing or exaggerated claims

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for emphasis on key stats or player names
- Keep paragraphs concise (3-4 sentences max)
- Include a compelling but professional opening
- End with thoughtful analysis or forward-looking perspective

Team context:
- Sabres: NHL team in Buffalo, NY. Colors: blue and gold. Arena: KeyBank Center. Notable players include Tage Thompson, Rasmus Dahlin, Owen Power, JJ Peterka. ALWAYS verify the current roster via web search as it changes frequently.
- Bills: NFL team in Buffalo, NY. Colors: red, blue, white. Stadium: Highmark Stadium. Notable players include Josh Allen, James Cook. ALWAYS verify the current roster via web search.

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

  const { idea, team, title, researchEnabled = false, allowedDomains, referenceDate } = req.body;

  // Validate required fields
  if (!idea || !team) {
    return res.status(400).json({
      error: 'Missing required fields: idea and team are required',
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'AI service not configured',
      details: 'ANTHROPIC_API_KEY environment variable is not set',
    });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Build the user prompt
    const teamName = team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills';

    // Add research instructions if enabled
    const dateContext = referenceDate ? `\n\nTODAY'S DATE: ${referenceDate}` : '';
    const researchInstructions = researchEnabled
      ? `${dateContext}

CRITICAL RESEARCH INSTRUCTIONS:
Before writing, you MUST search for and verify the following current data:

1. STANDINGS: Search "${team === 'sabres' ? 'NHL' : 'NFL'} standings ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}" to get:
   - Current points/wins total
   - Division/conference position
   - Games played
   - Current streak

2. ROSTER: Search "${team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills'} current roster 2024-25" to verify:
   - Active players on the team
   - Recent trades or transactions
   - Injured players

3. RECENT GAMES: Search for recent game results and scores

IMPORTANT: Do NOT rely on cached knowledge - verify all stats and roster information through web search. Reject any data that appears outdated.${
          allowedDomains?.length
            ? `\n\nTrusted sources to prioritize: ${allowedDomains.join(', ')}`
            : ''
        }`
      : '';

    const userPrompt = `Write an article for the ${teamName} based on the following idea:

${idea}${researchInstructions}

${title ? `Suggested title: "${title}"` : 'Please also suggest a compelling, SEO-friendly title.'}

Please provide your response in this exact format:
TITLE: [Your title here]
META: [A brief meta description for SEO, max 160 characters]
---
[Article content in Markdown format]

The article should be 400-800 words and follow the style guidelines provided.`;

    // Configure web search tool if research is enabled
    const tools = researchEnabled
      ? [{ type: 'web_search_20250305', name: 'web_search' }]
      : undefined;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      ...(tools && { tools }),
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

    if (error.status === 401) {
      return res.status(500).json({
        error: 'AI service authentication failed',
        details: 'Invalid API key. Please check ANTHROPIC_API_KEY in Vercel settings.',
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request to AI service.',
        details: error.message,
      });
    }

    // Generic error with more details
    return res.status(500).json({
      error: 'Failed to generate article',
      details: error.message || 'Unknown error',
      errorType: error.name || 'Error',
      status: error.status || null,
    });
  }
}
