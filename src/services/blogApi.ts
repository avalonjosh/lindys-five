import type { BlogPost } from '../types';

const API_BASE = '/api/blog';

interface PostsResponse {
  posts: BlogPost[];
  total: number;
  limit: number;
  offset: number;
}

interface PostResponse {
  post: BlogPost;
}

export async function fetchPosts(options?: {
  team?: 'sabres' | 'bills';
  status?: 'draft' | 'published';
  type?: 'game-recap' | 'set-recap' | 'custom';
  limit?: number;
  offset?: number;
}): Promise<PostsResponse> {
  const params = new URLSearchParams();
  if (options?.team) params.set('team', options.team);
  if (options?.status) params.set('status', options.status);
  if (options?.type) params.set('type', options.type);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());

  const url = `${API_BASE}/posts${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch posts');
  }

  return response.json();
}

export async function fetchPost(slug: string): Promise<PostResponse> {
  const response = await fetch(`${API_BASE}/posts/${slug}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Post not found');
    }
    throw new Error('Failed to fetch post');
  }

  return response.json();
}

export async function createPost(post: Partial<BlogPost>): Promise<{ success: boolean; post: BlogPost }> {
  const response = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create post');
  }

  return response.json();
}

export async function updatePost(slug: string, updates: Partial<BlogPost>): Promise<{ success: boolean; post: BlogPost }> {
  const response = await fetch(`${API_BASE}/posts/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update post');
  }

  return response.json();
}

export async function deletePost(slug: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/posts/${slug}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete post');
  }

  return response.json();
}

// AI Article Generation
interface GenerateArticleRequest {
  idea: string;
  team: 'sabres' | 'bills';
  title?: string;
  researchEnabled?: boolean;
  allowedDomains?: string[];
  referenceDate?: string;
  gameId?: number;
  postType?: 'game-recap' | 'set-recap' | 'custom';
}

interface GenerateArticleResponse {
  success: boolean;
  content: string;
  title: string;
  metaDescription: string;
  model: string;
}

export async function generateArticle(
  request: GenerateArticleRequest
): Promise<GenerateArticleResponse> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate article');
  }

  return response.json();
}

// Image Upload
interface UploadImageResponse {
  success: boolean;
  url: string;
  filename: string;
}

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
    // Note: Don't set Content-Type header - browser sets it with boundary
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload image');
  }

  return response.json();
}
