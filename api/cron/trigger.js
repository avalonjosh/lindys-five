import { jwtVerify } from 'jose';

// Static imports - required for Vercel bundling (dynamic imports don't work)
import weeklyRoundupHandler from './weekly-roundup.js';
import newsScanHandler from './news-scan.js';
import gameRecapHandler from './game-recap.js';
import setRecapHandler from './set-recap.js';
import billsNewsScanHandler from './bills-news-scan.js';
import billsWeeklyRoundupHandler from './bills-weekly-roundup.js';
import billsGameRecapHandler from './bills-game-recap.js';

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

// Map trigger types to their handlers
const handlers = {
  // Sabres
  'weekly': weeklyRoundupHandler,
  'news': newsScanHandler,
  'game-recap': gameRecapHandler,
  'set-recap': setRecapHandler,
  // Bills
  'bills-news': billsNewsScanHandler,
  'bills-weekly': billsWeeklyRoundupHandler,
  'bills-game-recap': billsGameRecapHandler
};

const validTypes = Object.keys(handlers);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized - admin access required' });
  }

  const { type, setNumber, force } = req.body;

  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid trigger type',
      validTypes
    });
  }

  try {
    // Get the handler from static imports
    const cronHandler = handlers[type];

    // Create a mock request with cron authorization
    // Include additional params for set-recap
    const mockReq = {
      ...req,
      headers: {
        ...req.headers,
        authorization: `Bearer ${process.env.CRON_SECRET}`
      },
      body: {
        ...req.body,
        setNumber: type === 'set-recap' ? setNumber : undefined,
        force: type === 'set-recap' ? force : undefined
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
