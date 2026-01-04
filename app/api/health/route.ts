import { NextRequest, NextResponse } from 'next/server';
import { OuraClient, createOuraClientWithD1 } from '@/lib/oura-client';
import { WhoopClient, createWhoopClientWithD1 } from '@/lib/whoop-client';
import { processHealthData, generateDailyData } from '@/lib/data-aggregator';
import { getDateRange } from '@/lib/utils';
import { D1Client } from '@/lib/d1-client';
import type { D1Database } from '@/lib/d1-client';

export const runtime = 'edge';

interface CloudflareEnv {
  DB: D1Database;
}

function getD1(): D1Database | undefined {
  return (process.env as unknown as CloudflareEnv).DB;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);

    const { start, end } = getDateRange(weeks);
    const db = getD1();

    let ouraData = null;
    let whoopData = null;

    // Try to get Oura data - first from D1, then from env
    try {
      if (db) {
        const ouraClient = await createOuraClientWithD1(db);
        if (ouraClient) {
          ouraData = await ouraClient.getAllData(start, end);
        }
      }
      // Fallback to env token
      if (!ouraData && process.env.OURA_ACCESS_TOKEN) {
        const ouraClient = new OuraClient(process.env.OURA_ACCESS_TOKEN);
        ouraData = await ouraClient.getAllData(start, end);
      }
    } catch (error) {
      console.error('Oura API error:', error);
    }

    // Try to get Whoop data - first from D1, then from env
    try {
      if (db) {
        const whoopClient = await createWhoopClientWithD1(db);
        if (whoopClient) {
          whoopData = await whoopClient.getAllData(start, end);
        }
      }
      // Fallback to env token
      if (!whoopData && process.env.WHOOP_ACCESS_TOKEN) {
        const whoopClient = new WhoopClient(process.env.WHOOP_ACCESS_TOKEN);
        whoopData = await whoopClient.getAllData(start, end);
      }
    } catch (error) {
      console.error('Whoop API error:', error);
    }

    if (!ouraData && !whoopData) {
      return NextResponse.json({
        success: true,
        data: getDemoData(),
        sources: { oura: false, whoop: false },
        message: 'Using demo data. Connect Oura or Whoop to see real data.',
      });
    }

    // Generate daily data and save to D1
    let savedCount = 0;
    if (db) {
      try {
        const dailyData = generateDailyData(ouraData, whoopData, start, end);
        // Filter out days with no data
        const validDays = dailyData.filter(
          (d) => d.oura || d.whoop
        );
        if (validDays.length > 0) {
          const d1Client = new D1Client(db);
          savedCount = await d1Client.saveDailyRecords(validDays);
        }
      } catch (e) {
        console.error('Failed to save daily data to D1:', e);
      }
    }

    const weeklyData = processHealthData(ouraData, whoopData, start, end);

    return NextResponse.json({
      success: true,
      data: weeklyData,
      sources: {
        oura: !!ouraData,
        whoop: !!whoopData,
      },
      saved: savedCount,
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

function getDemoData() {
  const result: any[] = [];
  const now = new Date();
  const today = now.getDay(); // 0=Sunday, 1=Monday, etc.

  // Generate 12 weeks of data, newest first
  for (let i = 0; i < 12; i++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7 - today); // Go to Sunday of that week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekNum = Math.ceil(
      (weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    const isCurrentWeek = i === 0;
    // Sunday = 0, so for current week: Sunday = 1 day, Monday = 2 days, etc.
    const daysInWeek = isCurrentWeek ? (today === 0 ? 1 : today + 1) : 7;

    // For current incomplete week, show daily breakdown
    if (isCurrentWeek && daysInWeek < 7) {
      // Generate daily data
      const dailyRows: any[] = [];
      let totalMetMin = 0;
      let totalReadiness = 0;
      let totalRecovery = 0;
      let totalSleep = 0;
      let totalHrv = 0;
      let totalSteps = 0;

      for (let d = 0; d < daysInWeek; d++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(dayDate.getDate() + d);

        const dailyMetMin = Math.floor(Math.random() * 150) + 100; // 100-250 per day
        const readiness = Math.floor(Math.random() * 30) + 60;
        const recovery = Math.floor(Math.random() * 40) + 40;
        const sleep = Math.floor(Math.random() * 25) + 65;
        const hrv = Math.floor(Math.random() * 40) + 30;
        const steps = Math.floor(Math.random() * 5000) + 6000;

        totalMetMin += dailyMetMin;
        totalReadiness += readiness;
        totalRecovery += recovery;
        totalSleep += sleep;
        totalHrv += hrv;
        totalSteps += steps;

        dailyRows.push({
          week: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
          date_range: `${(dayDate.getMonth() + 1).toString().padStart(2, '0')}/${dayDate.getDate().toString().padStart(2, '0')}`,
          start_date: dayDate.toISOString().split('T')[0],
          end_date: dayDate.toISOString().split('T')[0],
          daily_data: [],
          days_count: 1,
          avg_readiness: readiness,
          avg_recovery: recovery,
          avg_sleep: sleep,
          avg_hrv: hrv,
          avg_steps: steps,
          total_strain: null,
          total_met_minutes: dailyMetMin,
          cumulative_met_minutes: totalMetMin,
          zone: getZone(dailyMetMin, recovery),
          trend: '→',
          health_status: '健康',
          row_type: 'day',
        });
      }

      // Sum row first
      const avgRecovery = Math.round(totalRecovery / daysInWeek);
      result.push({
        week: `Week ${weekNum}`,
        date_range: `${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')} - now`,
        start_date: weekStart.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        daily_data: [],
        days_count: daysInWeek,
        avg_readiness: Math.round(totalReadiness / daysInWeek),
        avg_recovery: avgRecovery,
        avg_sleep: Math.round(totalSleep / daysInWeek),
        avg_hrv: Math.round(totalHrv / daysInWeek),
        avg_steps: Math.round(totalSteps / daysInWeek),
        total_strain: null,
        total_met_minutes: totalMetMin,
        zone: getZone(Math.round(totalMetMin / daysInWeek), avgRecovery),
        trend: '→',
        health_status: '健康',
        row_type: 'week_cumulative',
      });

      // Then daily rows
      result.push(...dailyRows);
    } else {
      // Complete week - show as single row
      const dailyMetMin = Math.floor(Math.random() * 150) + 100; // 100-250 per day avg
      const totalMetMin = dailyMetMin * 7;
      const readiness = Math.floor(Math.random() * 30) + 60;
      const recovery = Math.floor(Math.random() * 40) + 40;
      const sleep = Math.floor(Math.random() * 25) + 65;
      const hrv = Math.floor(Math.random() * 40) + 30;
      const steps = Math.floor(Math.random() * 5000) + 6000;

      result.push({
        week: `Week ${weekNum}`,
        date_range: `${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')} - ${(weekEnd.getMonth() + 1).toString().padStart(2, '0')}/${weekEnd.getDate().toString().padStart(2, '0')}`,
        start_date: weekStart.toISOString().split('T')[0],
        end_date: weekEnd.toISOString().split('T')[0],
        daily_data: [],
        days_count: 7,
        avg_readiness: readiness,
        avg_recovery: recovery,
        avg_sleep: sleep,
        avg_hrv: hrv,
        avg_steps: steps,
        total_strain: null,
        total_met_minutes: totalMetMin,
        zone: getZone(dailyMetMin, recovery),
        trend: ['↑', '→', '↓'][Math.floor(Math.random() * 3)],
        health_status: '健康',
        row_type: 'week',
      });
    }
  }

  return result;
}

function getZone(dailyMetMin: number, recovery: number): string {
  if (dailyMetMin > 350) return 'J型右侧风险';
  if (dailyMetMin > 300) return '右侧临界';
  if (dailyMetMin > 250) return '高负荷';
  if (dailyMetMin > 200) return '轻度高负荷';
  if (dailyMetMin > 180) return '稍高';
  if (recovery >= 67 && dailyMetMin >= 150 && dailyMetMin <= 180) return '黄金锚点';
  if (recovery >= 67 && dailyMetMin >= 100 && dailyMetMin <= 200) return '最优区';
  if (recovery < 34) return '恢复稳态';
  if (dailyMetMin >= 100 && dailyMetMin <= 200) return '最优区';
  return '恢复稳态';
}
