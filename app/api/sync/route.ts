import { NextRequest, NextResponse } from 'next/server';
import { OuraClient } from '@/lib/oura-client';
import { WhoopClient } from '@/lib/whoop-client';
import { D1Client, type D1Database } from '@/lib/d1-client';
import { aggregateDailyData, generateDateRange, groupByDate } from '@/lib/data-aggregator';
import { getDateRange } from '@/lib/utils';

export const runtime = 'edge';

// Get D1 database from request context (Cloudflare Pages)
function getD1(request: NextRequest): D1Database | null {
  // In Cloudflare Pages, D1 is available via env bindings
  // @ts-expect-error - Cloudflare env bindings
  const env = request.cf?.env || globalThis.env;
  return env?.DB || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const weeks = body.weeks || 12;
    const source = body.source || 'all'; // 'oura', 'whoop', or 'all'

    const { start, end } = getDateRange(weeks);

    // Get tokens
    const ouraToken = process.env.OURA_ACCESS_TOKEN || request.headers.get('X-Oura-Token');
    const whoopToken = process.env.WHOOP_ACCESS_TOKEN || request.headers.get('X-Whoop-Token');

    // Get D1 database
    const db = getD1(request);
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not configured. Set up D1 in Cloudflare.' },
        { status: 500 }
      );
    }

    const d1 = new D1Client(db);
    const results = { oura: 0, whoop: 0, total: 0 };

    // Fetch Oura data
    let ouraData = null;
    if ((source === 'all' || source === 'oura') && ouraToken) {
      const syncId = await d1.logSync('oura', 'full', start, end);
      try {
        const ouraClient = new OuraClient(ouraToken);
        ouraData = await ouraClient.getAllData(start, end);
        results.oura = ouraData.readiness.length;
        await d1.updateSyncLog(syncId, 'success', results.oura);
      } catch (error) {
        await d1.updateSyncLog(
          syncId,
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Fetch Whoop data
    let whoopData = null;
    if ((source === 'all' || source === 'whoop') && whoopToken) {
      const syncId = await d1.logSync('whoop', 'full', start, end);
      try {
        const whoopClient = new WhoopClient(whoopToken);
        whoopData = await whoopClient.getAllData(start, end);
        results.whoop = whoopData.recovery.length;
        await d1.updateSyncLog(syncId, 'success', results.whoop);
      } catch (error) {
        await d1.updateSyncLog(
          syncId,
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Process and save daily records
    if (ouraData || whoopData) {
      // Group data by date
      const ouraReadinessMap = ouraData ? groupByDate(ouraData.readiness, 'day') : new Map();
      const ouraSleepMap = ouraData ? groupByDate(ouraData.sleep, 'day') : new Map();
      const ouraActivityMap = ouraData ? groupByDate(ouraData.activity, 'day') : new Map();

      const whoopRecoveryMap = whoopData
        ? new Map(whoopData.recovery.map((r) => [r.created_at.split('T')[0], r]))
        : new Map();
      const whoopCycleMap = whoopData
        ? new Map(whoopData.cycles.map((c) => [c.start.split('T')[0], c]))
        : new Map();
      const whoopSleepMap = whoopData
        ? new Map(whoopData.sleep.map((s) => [s.start.split('T')[0], s]))
        : new Map();

      // Generate daily records
      const dates = generateDateRange(start, end);
      for (const date of dates) {
        const dailyData = aggregateDailyData(
          date,
          ouraReadinessMap.get(date),
          ouraSleepMap.get(date),
          ouraActivityMap.get(date),
          whoopRecoveryMap.get(date),
          whoopCycleMap.get(date),
          whoopSleepMap.get(date)
        );
        await d1.saveDailyRecord(dailyData);
        results.total++;
      }
    }

    return NextResponse.json({
      success: true,
      synced: results,
      dateRange: { start, end },
      message: `Synced ${results.total} days of data`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

// GET - Check sync status
export async function GET(request: NextRequest) {
  const db = getD1(request);

  if (!db) {
    return NextResponse.json({
      configured: false,
      message: 'D1 database not configured',
    });
  }

  try {
    const d1 = new D1Client(db);
    const [ouraLastSync, whoopLastSync] = await Promise.all([
      d1.getLastSyncTime('oura'),
      d1.getLastSyncTime('whoop'),
    ]);

    return NextResponse.json({
      configured: true,
      lastSync: {
        oura: ouraLastSync,
        whoop: whoopLastSync,
      },
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
    });
  }
}
