import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/nhl-api', '');
  const url = `https://api-web.nhle.com${path}`;

  console.log('Netlify function called with path:', path);
  console.log('Full URL:', url);

  try {
    const response = await fetch(url);
    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('Data received successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error in Netlify function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to fetch from NHL API',
        details: error instanceof Error ? error.message : String(error),
        url: url
      }),
    };
  }
};
