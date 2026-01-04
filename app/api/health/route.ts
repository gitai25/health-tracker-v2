import { NextRequest, NextResponse } from 'next/server';
import { OuraClient } from '@/lib/oura-client';
import { WhoopClient } from '@/lib/whoop-client';
import { processHealthData } from '@/lib/data-aggregator';
import { loadLocalData, processLocalData, checkDataSources } from '@/lib/local-data';
import { getDateRange } from '@/lib/utils';
import { requireAdmin } from '@/lib/admin-auth';

// Use nodejs runtime for local file access
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

    const searchParams = request.nextUrl.searchParams;
    const weeks = parseInt(searchParams.get('weeks') || '12', 10);
    const source = searchParams.get('source') || 'auto'; // 'auto', 'local', 'api'

    // Try local data first (from sync script)
    if (source === 'local' || source === 'auto') {
      const localData = loadLocalData();
      if (localData && localData.daily.length > 0) {
        const weeklyData = processLocalData(localData);
        const sources = checkDataSources(localData);

        return NextResponse.json({
          success: true,
          data: weeklyData.slice(0, weeks),
          sources: { ...sources, cached: true },
          lastSync: localData.last_sync,
          message: `Data from local cache (last sync: ${new Date(localData.last_sync).toLocaleString()})`,
        });
      }
    }

    // Fall back to API if no local data or source=api
    const { start, end } = getDateRange(weeks);

    const ouraToken = process.env.OURA_ACCESS_TOKEN;
    const whoopToken = process.env.WHOOP_ACCESS_TOKEN;

    let ouraData = null;
    let whoopData = null;

    if (ouraToken) {
      try {
        const ouraClient = new OuraClient(ouraToken);
        ouraData = await ouraClient.getAllData(start, end);
      } catch (error) {
        console.error('Oura API error:', error);
      }
    }

    if (whoopToken) {
      try {
        const whoopClient = new WhoopClient(whoopToken);
        whoopData = await whoopClient.getAllData(start, end);
      } catch (error) {
        console.error('Whoop API error:', error);
      }
    }

    if (!ouraData && !whoopData) {
      return NextResponse.json({
        success: true,
        data: getDemoData(),
        sources: { oura: false, whoop: false },
        message: 'Using demo data. Connect Oura or Whoop to see real data.',
      });
    }

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

// Demo data
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

    const readiness = Math.floor(Math.random() * 30) + 60;
    const recovery = Math.floor(Math.random() * 40) + 40;
    const sleep = Math.floor(Math.random() * 25) + 65;
    const hrv = Math.floor(Math.random() * 40) + 30;
    const steps = Math.floor(Math.random() * 5000) + 6000;
    const metMin = Math.floor(Math.random() * 400) + 900;

    let zone = '最优区';
    if (metMin > 1400) zone = '高负荷';
    else if (metMin > 1200) zone = '轻度高负荷';
    else if (metMin > 1100) zone = '稍高';
    else if (recovery > 67 && metMin >= 1000 && metMin <= 1100) zone = '黄金锚点';
    else if (recovery < 34) zone = '恢复稳态';

    // Current week shows partial data
    const isCurrentWeek = i === 0;
    const daysInWeek = isCurrentWeek ? new Date().getDay() || 7 : 7;

    weeks.push({
      week: isCurrentWeek ? `Week ${weekNum} (${daysInWeek}/7 days)` : `Week ${weekNum}`,
      date_range: `${(weekStart.getMonth() + 1).toString().padStart(2, '0')}/${weekStart.getDate().toString().padStart(2, '0')} - ${(weekEnd.getMonth() + 1).toString().padStart(2, '0')}/${weekEnd.getDate().toString().padStart(2, '0')}`,
      start_date: weekStart.toISOString().split('T')[0],
      end_date: weekEnd.toISOString().split('T')[0],
      daily_data: [],
      days_count: daysInWeek,
      avg_readiness: readiness,
      avg_recovery: recovery,
      avg_sleep: sleep,
      avg_hrv: hrv,
      avg_steps: steps,
      total_strain: null,
      total_met_minutes: metMin * daysInWeek,
      zone,
      trend: ['↑', '→', '↓'][Math.floor(Math.random() * 3)],
      health_status: '健康',
    });
  }

  return weeks;
}
