import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for Blob token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Image storage not configured', details: 'BLOB_READ_WRITE_TOKEN environment variable is not set' },
      { status: 500 }
    );
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
        if ((blob as any).contentType?.startsWith('image/')) return true;
        // Fallback to checking file extension
        const pathname = blob.pathname?.toLowerCase() || '';
        return imageExtensions.some(ext => pathname.endsWith(ext));
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .map(blob => ({
        url: blob.url,
        filename: blob.pathname,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
      }));

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
      totalBlobs: blobs.length,
    });
  } catch (error: any) {
    console.error('Error listing images:', error);
    return NextResponse.json(
      { error: 'Failed to list images', details: error.message },
      { status: 500 }
    );
  }
}
