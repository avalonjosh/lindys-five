export default async function handler(req, res) {
  // Vercel rewrites pass the original path in query params
  // The path will be like: /api/v1/club-schedule-season/BUF/20252026
  const originalUrl = req.headers['x-vercel-original-url'] || req.url;
  const path = originalUrl.replace('/api/v1', '');
  const url = `https://api-web.nhle.com/v1${path}`;

  console.log('Vercel function called');
  console.log('Original URL:', originalUrl);
  console.log('Extracted path:', path);
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
