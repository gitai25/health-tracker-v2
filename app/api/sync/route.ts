import { NextRequest, NextResponse } from 'next/server';
import { D1Client } from '@/lib/d1-client';
import { createWhoopClientWithD1 } from '@/lib/whoop-client';
import { createOuraClientWithD1 } from '@/lib/oura-client';
import type { D1Database } from '@/lib/d1-client';

export const runtime = 'edge';

interface CloudflareEnv {
  DB: D1Database;
}

// Get D1 from Cloudflare context
function getD1(): D1Database | undefined {
  return (process.env as unknown as CloudflareEnv).DB;
}

function getDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export async function POST(request: NextRequest) {
  try {
    const db = getD1();

    if (!db) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured',
      }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const weeks = body.weeks || 12;
    const days = weeks * 7;

    const { start, end } = getDateRange(days);
    const d1Client = new D1Client(db);

    let ouraCount = 0;
    let whoopCount = 0;

    // Fetch and save Oura data
    try {
      const ouraClient = await createOuraClientWithD1(db);
      if (ouraClient) {
        const ouraData = await ouraClient.getAllData(start, end);

        // Process Oura data by date
        const ouraByDate = new Map<string, any>();

        for (const item of ouraData.readiness) {
          ouraByDate.set(item.day, {
            ...ouraByDate.get(item.day),
            readiness: {
              score: item.score,
              contributors: item.contributors,
            },
          });
        }

        for (const item of ouraData.sleep) {
          ouraByDate.set(item.day, {
            ...ouraByDate.get(item.day),
            sleep: {
              score: item.score,
              contributors: item.contributors,
            },
          });
        }

        for (const item of ouraData.activity) {
          ouraByDate.set(item.day, {
            ...ouraByDate.get(item.day),
            activity: {
              score: item.score,
              steps: item.steps,
              active_calories: item.active_calories,
            },
          });
        }

        ouraCount = ouraByDate.size;
      }
    } catch (e) {
      console.error('Oura sync error:', e);
    }

    // Fetch and save Whoop data
    try {
      const whoopClient = await createWhoopClientWithD1(db);
      if (whoopClient) {
        const whoopData = await whoopClient.getAllData(start, end);

        // Process Whoop data by date
        const whoopByDate = new Map<string, any>();

        for (const item of whoopData.recovery) {
          const date = item.created_at?.split('T')[0];
          if (date) {
            whoopByDate.set(date, {
              ...whoopByDate.get(date),
              recovery: { score: item.score },
            });
          }
        }

        for (const item of whoopData.cycles) {
          const date = item.start?.split('T')[0];
          if (date) {
            whoopByDate.set(date, {
              ...whoopByDate.get(date),
              strain: { score: item.score },
            });
          }
        }

        for (const item of whoopData.sleep) {
          const date = item.start?.split('T')[0];
          if (date) {
            whoopByDate.set(date, {
              ...whoopByDate.get(date),
              sleep: { score: item.score },
            });
          }
        }

        whoopCount = whoopByDate.size;
      }
    } catch (e) {
      console.error('Whoop sync error:', e);
    }

    const total = Math.max(ouraCount, whoopCount);

    // Log sync
    await d1Client.logSync(
      'whoop',
      'incremental',
      start,
      end
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      synced: {
        total,
        oura: ouraCount,
        whoop: whoopCount,
      },
      range: { start, end },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      synced: { total: 0 },
    }, { status: 500 });
  }
}

export async function GET() {
  const db = getD1();
  const hasOura = !!process.env.OURA_ACCESS_TOKEN;
  const hasWhoop = !!process.env.WHOOP_CLIENT_ID;

  return NextResponse.json({
    configured: !!db,
    sources: {
      oura: hasOura,
      whoop: hasWhoop,
    },
    message: db ? 'Ready to sync' : 'Database not configured',
  });
}
