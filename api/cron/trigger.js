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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized - admin access required' });
  }

  const { type } = req.body;

  const validTypes = [
    // Sabres
    'weekly', 'news', 'game-recap', 'set-recap',
    // Bills
    'bills-news', 'bills-weekly', 'bills-game-recap'
  ];

  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid trigger type',
      validTypes
    });
  }

  try {
    // Determine which handler to call
    const handlerPath = {
      // Sabres
      'weekly': './weekly-roundup.js',
      'news': './news-scan.js',
      'game-recap': './game-recap.js',
      'set-recap': './set-recap.js',
      // Bills
      'bills-news': './bills-news-scan.js',
      'bills-weekly': './bills-weekly-roundup.js',
      'bills-game-recap': './bills-game-recap.js'
    }[type];

    // Dynamically import the handler
    const { default: cronHandler } = await import(handlerPath);

    // Create a mock request with cron authorization
    const mockReq = {
      ...req,
      headers: {
        ...req.headers,
        authorization: `Bearer ${process.env.CRON_SECRET}`
      }
    };

    // Create a mock response to capture the result
    let responseData = null;
    let statusCode = 200;

    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    // Call the cron handler
    await cronHandler(mockReq, mockRes);

    return res.status(statusCode).json({
      triggered: type,
      ...responseData
    });

  } catch (error) {
    console.error(`Failed to trigger ${type}:`, error);
    return res.status(500).json({
      error: `Failed to trigger ${type}`,
      message: error.message
    });
  }
}
