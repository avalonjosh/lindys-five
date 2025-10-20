import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/nhl-api', '');
  const url = `https://api-web.nhle.com${path}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch from NHL API' }),
    };
  }
};
