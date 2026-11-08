// Only for a project with no database layer yet (install.mjs nextjs --with-db).
// Loads .env.local the way Next does, so drizzle-kit sees DATABASE_URL.
// If the app lives in src/, change schema to './src/lib/auth/schema.ts'.
import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/auth/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
