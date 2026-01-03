import { NextRequest, NextResponse } from 'next/server';
import { OuraClient } from '@/lib/oura-client';
import { WhoopClient } from '@/lib/whoop-client';
import { processHealthData } from '@/lib/data-aggregator';
import { D1Client, dbRecordToWeeklyData, type D1Database } from '@/lib/d1-client';
import { getDateRange } from '@/lib/utils';

export const runtime = 'edge';

// Get D1 database from request context (Cloudflare Pages)
function getD1(request: NextRequest): D1Database | null {
  // @ts-expect-error - Cloudflare env bindings
  const env = request.cf?.env || globalThis.env;
  return env?.DB || null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);
    const useCache = searchParams.get('cache') !== 'false';

    const { start, end } = getDateRange(weeks);

    // Try to get data from D1 first (if available and cache enabled)
    const db = getD1(request);
    if (db && useCache) {
      try {
        const d1 = new D1Client(db);
        const dbRecords = await d1.getWeeklyRecords(weeks);

        if (dbRecords.length > 0) {
          return NextResponse.json({
            success: true,
            data: dbRecords.map(dbRecordToWeeklyData),
            sources: { oura: true, whoop: true, cached: true },
            message: 'Data from database cache',
          });
        }
      } catch (error) {
        console.error('D1 read error:', error);
        // Fall through to API fetch
      }
    }

    // Get tokens from environment or request headers
    const ouraToken =
      process.env.OURA_ACCESS_TOKEN ||
      request.headers.get('X-Oura-Token');
    const whoopToken =
      process.env.WHOOP_ACCESS_TOKEN ||
      request.headers.get('X-Whoop-Token');

    let ouraData = null;
    let whoopData = null;

    // Fetch Oura data if token available
    if (ouraToken) {
      try {
        const ouraClient = new OuraClient(ouraToken);
        ouraData = await ouraClient.getAllData(start, end);
      } catch (error) {
        console.error('Oura API error:', error);
      }
    }

    // Fetch Whoop data if token available
    if (whoopToken) {
      try {
        const whoopClient = new WhoopClient(whoopToken);
        whoopData = await whoopClient.getAllData(start, end);
      } catch (error) {
        console.error('Whoop API error:', error);
      }
    }

    // If no data sources available, return demo data
    if (!ouraData && !whoopData) {
      return NextResponse.json({
        success: true,
        data: getDemoData(),
        sources: { oura: false, whoop: false },
        message: 'Using demo data. Connect Oura or Whoop to see real data.',
      });
    }

    // Process and aggregate data
    const weeklyData = processHealthData(ouraData, whoopData, start, end);

    return NextResponse.json({
      success: true,
      data: weeklyData,
      sources: {
        oura: !!ouraData,
        whoop: !!whoopData,
      },
    });
  } catch (error) {
    console.error('Health API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Demo data for when no APIs are connected
function getDemoData() {
  const weeks = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekNum = Math.ceil(
      (weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    // Generate random but realistic data
    const readiness = Math.floor(Math.random() * 30) + 60;
    const recovery = Math.floor(Math.random() * 40) + 40;
    const sleep = Math.floor(Math.random() * 25) + 65;
    const hrv = Math.floor(Math.random() * 40) + 30;
    const steps = Math.floor(Math.random() * 5000) + 6000;
    const strain = Math.random() * 10 + 8;

    let zone = '最优区';
    if (strain > 16) zone = '高负荷';
    else if (strain > 14) zone = '轻度高负荷';
    else if (recovery > 67) zone = '黄金锚点';
    else if (recovery < 34) zone = '恢复稳态';

    weeks.push({
      week: `Week ${weekNum}`,
      date_range: `${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')} - ${(weekEnd.getMonth() + 1).toString().padStart(2, '0')}/${weekEnd.getDate().toString().padStart(2, '0')}`,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0],
      daily_data: [],
      avg_readiness: readiness,
      avg_recovery: recovery,
      avg_sleep: sleep,
      avg_hrv: hrv,
      avg_steps: steps,
      total_strain: Math.round(strain * 7 * 10) / 10,
      zone,
      trend: ['↑', '→', '↓'][Math.floor(Math.random() * 3)],
      health_status: '健康',
    });
  }

  return weeks;
}
