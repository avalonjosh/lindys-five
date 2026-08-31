import { kv } from '@vercel/kv';
import type { BlogPost } from './types';

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const postId = await kv.get<string>(`blog:slug:${slug}`);
  if (!postId) return null;

  const post = await kv.get<BlogPost>(`blog:post:${postId}`);
  if (!post) return null;

  return post;
}

/** Hydrate posts by id in mget batches — one round trip per 50 posts instead
 * of one sequential get per post (each get is an HTTP call on Vercel KV). */
export async function getPostsByIds(postIds: string[]): Promise<(BlogPost | null)[]> {
  const out: (BlogPost | null)[] = [];
  for (let i = 0; i < postIds.length; i += 50) {
    const chunk = postIds.slice(i, i + 50);
    const posts = await kv.mget<(BlogPost | null)[]>(...chunk.map((id) => `blog:post:${id}`));
    out.push(...posts);
  }
  return out;
}

export async function getPublishedPosts(team?: string, type?: string): Promise<BlogPost[]> {
  // blog:posts is a sorted set (zadd), so use zrange not smembers
  // Fetch all IDs in reverse score order (newest first)
  let key = 'blog:posts';
  if (team) key = `blog:posts:${team}`;
  if (type) key = `blog:posts:type:${type}`;

  const postIds = await kv.zrange<string[]>(key, 0, -1, { rev: true });
  if (!postIds || postIds.length === 0) return [];

  const posts: BlogPost[] = [];

  for (const post of await getPostsByIds(postIds)) {
    if (!post || post.status !== 'published') continue;
    if (team && !key.includes(team) && post.team !== team) continue;
    if (type && !key.includes(type) && post.type !== type) continue;
    posts.push(post);
  }

  return posts;
}
