import { put } from '@vercel/blob';
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

// Allowed file types and max size
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const config = {
  api: {
    bodyParser: false, // Required for handling multipart/form-data
  },
};

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
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
      error: 'Image upload not configured',
      details: 'BLOB_READ_WRITE_TOKEN environment variable is not set',
    });
  }

  try {
    // Parse the multipart form data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Extract boundary from content-type header
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid form data: missing boundary' });
    }

    // Parse multipart data to extract file
    const { filename, fileBuffer, mimeType } = parseMultipart(buffer, boundary);

    if (!filename || !fileBuffer) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.map((t) => t.split('/')[1]).join(', ')}`,
      });
    }

    // Validate file size
    if (fileBuffer.length > MAX_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`,
      });
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-');
    const blobFilename = `blog/${timestamp}-${sanitizedFilename}`;

    // Upload to Vercel Blob
    const blob = await put(blobFilename, fileBuffer, {
      access: 'public',
      contentType: mimeType,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      filename: blobFilename,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
      details: error.message,
    });
  }
}

// Simple multipart parser for extracting file data
function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;
  let idx;

  // Find all parts separated by boundary
  while ((idx = buffer.indexOf(boundaryBuffer, start)) !== -1) {
    if (start > 0) {
      // Remove trailing CRLF before boundary
      const partEnd = idx >= 2 ? idx - 2 : idx;
      parts.push(buffer.slice(start, partEnd));
    }
    start = idx + boundaryBuffer.length;
    // Skip CRLF after boundary
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) {
      start += 2;
    }
  }

  // Find the file part
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4);

    // Check if this is a file field
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    if (filenameMatch && contentTypeMatch) {
      return {
        filename: filenameMatch[1],
        fileBuffer: body,
        mimeType: contentTypeMatch[1].trim(),
      };
    }
  }

  return { filename: null, fileBuffer: null, mimeType: null };
}
