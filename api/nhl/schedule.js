/**
 * API proxy for NHL schedule data
 * Bypasses CORS restrictions by making server-to-server requests
 */
export default async function handler(req, res) {
  const { team, date } = req.query;

  if (!team || !date) {
    return res.status(400).json({ error: 'Missing required parameters: team and date' });
  }

  const url = `https://api-web.nhle.com/v1/club-schedule/${team}/week/${date}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes - schedule data doesn't change frequently
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    res.status(500).json({
      error: 'Failed to fetch schedule',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
