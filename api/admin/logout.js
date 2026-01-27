export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear the admin token cookie
  res.setHeader('Set-Cookie', [
    `admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  ]);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}
