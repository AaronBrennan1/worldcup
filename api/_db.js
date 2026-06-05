import { neon } from '@neondatabase/serverless';

// DATABASE_URL is set in Vercel's dashboard (Step 6), never hardcoded.
export const sql = neon(process.env.DATABASE_URL);