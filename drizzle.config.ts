import type { Config } from 'drizzle-kit';

// Migrations are managed with drizzle-kit. Generate locally and commit the SQL
// in lib/db/migrations, then apply against a Neon dev branch before prod.
export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  },
} satisfies Config;
