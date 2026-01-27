import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get the stored password hash from environment
    const storedHash = process.env.ADMIN_PASSWORD_HASH;

    if (!storedHash) {
      console.error('ADMIN_PASSWORD_HASH not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Create a JWT token
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);

    const token = await new SignJWT({ sub: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    // Set the token as an HTTP-only cookie
    res.setHeader('Set-Cookie', [
      `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    ]);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully'
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
