export default async function handler(req, res) {
  // Get the path from query parameter (passed by rewrite)
  // Also handle case where path might come from URL directly
  let path = req.query.path || '';

  // If path is empty, try to extract from the URL
  if (!path && req.url) {
    const urlPath = req.url.replace('/api/nhl-api', '').replace(/^\?path=/, '');
    if (urlPath && urlPath !== '/' && urlPath !== '') {
      path = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    }
  }

  const url = `https://api-web.nhle.com/v1/${path}`;

  console.log('Vercel function called');
  console.log('Full request URL:', req.url);
  console.log('Query params:', JSON.stringify(req.query));
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

    // Set cache-control headers to prevent stale data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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
