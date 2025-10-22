export default async function handler(req, res) {
  // Get the path from query parameter (passed by rewrite)
  const path = req.query.path || '';
  const url = `https://api-web.nhle.com/v1/${path}`;

  console.log('Vercel function called');
  console.log('Query params:', req.query);
  console.log('Path:', path);
  console.log('Final NHL API URL:', url);

  try {
    const response = await fetch(url);
    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Data received successfully');

    res.status(200).json(data);
  } catch (error) {
    console.error('Error in Vercel function:', error);
    res.status(500).json({
      error: 'Failed to fetch from NHL API',
      details: error instanceof Error ? error.message : String(error),
      url: url
    });
  }
}
