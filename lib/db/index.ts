import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Centralized Postgres access for Pick the Bills, mirroring how lib/kv.ts
// centralizes KV. The HTTP-based Neon driver suits Vercel's serverless
// functions (no connection pool to exhaust across short-lived invocations).

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  // Surfaced at call time rather than import time so non-DB routes are unaffected.
  console.warn('POSTGRES_URL is not set. Pick the Bills database access will fail.');
}

const sql = neon(connectionString || '');

export const db = drizzle(sql, { schema });

export * from './schema';
