import { list } from '@vercel/blob';
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
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check for Blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      error: 'Image storage not configured',
      details: 'BLOB_READ_WRITE_TOKEN environment variable is not set',
    });
  }

  try {
    // List all blobs in the blog folder
    const { blobs } = await list({
      prefix: 'blog/',
      limit: 100,
    });

    // Filter to image files (by extension if contentType not available)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const images = blobs
      .filter(blob => {
        // Check contentType first
        if (blob.contentType?.startsWith('image/')) return true;
        // Fallback to checking file extension
        const pathname = blob.pathname?.toLowerCase() || '';
        return imageExtensions.some(ext => pathname.endsWith(ext));
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map(blob => ({
        url: blob.url,
        filename: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }));

    return res.status(200).json({
      success: true,
      images,
      count: images.length,
      totalBlobs: blobs.length, // Debug info
    });
  } catch (error) {
    console.error('Error listing images:', error);
    return res.status(500).json({
      error: 'Failed to list images',
      details: error.message,
    });
  }
}
