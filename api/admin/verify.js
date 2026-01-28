import { jwtVerify } from 'jose';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the token from the cookie
    const token = req.cookies?.admin_token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated', authenticated: false });
    }

    // Verify the JWT
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);

    const { payload } = await jwtVerify(token, secret);

    // Token is valid
    return res.status(200).json({
      authenticated: true,
      user: payload.sub
    });
  } catch (error) {
    console.error('Auth verification error:', error);

    // Token is invalid or expired
    return res.status(401).json({
      error: 'Invalid or expired token',
      authenticated: false
    });
  }
}
