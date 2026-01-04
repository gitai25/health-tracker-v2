import type { D1Database } from './d1-client';

interface CloudflareEnv {
  DB: D1Database;
}

/**
 * Get D1 database instance from Cloudflare environment
 * Works in Cloudflare Pages/Workers runtime
 */
export function getD1(): D1Database | undefined {
  return (process.env as unknown as CloudflareEnv).DB;
}

/**
 * Check if D1 database is available
 */
export function hasD1(): boolean {
  return getD1() !== undefined;
}
