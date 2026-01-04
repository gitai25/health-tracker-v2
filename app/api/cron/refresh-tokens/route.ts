import { NextRequest, NextResponse } from 'next/server';
import { TokenStore } from '@/lib/token-store';
import { getD1 } from '@/lib/db-utils';

export const runtime = 'edge';

// Cron job to refresh tokens before they expire
// Call this endpoint hourly: GET /api/cron/refresh-tokens
export async function GET(request: NextRequest) {
  // Verify cron secret or allow from Cloudflare
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow if: no secret configured, or secret matches, or request is from Cloudflare cron
  const isAuthorized =
    !cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    request.headers.get('cf-worker') !== null;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured'
    }, { status: 500 });
  }

  const tokenStore = new TokenStore(db);
  const results: Record<string, string> = {};

  // Refresh Whoop token
  try {
    const whoopToken = await tokenStore.getValidAccessToken('whoop');
    results.whoop = whoopToken ? 'ok' : 'no_token';
  } catch (e) {
    results.whoop = `error: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  // Refresh Oura token (if using OAuth, not PAT)
  try {
    const ouraToken = await tokenStore.getValidAccessToken('oura');
    results.oura = ouraToken ? 'ok' : 'no_token';
  } catch (e) {
    results.oura = `error: ${e instanceof Error ? e.message : 'unknown'}`;
  }

  return NextResponse.json({
    success: true,
    refreshed_at: new Date().toISOString(),
    results,
  });
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
