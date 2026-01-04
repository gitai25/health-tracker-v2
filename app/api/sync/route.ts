import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Sync is not needed for Cloudflare deployment
// Data is fetched directly from Oura/Whoop APIs on each request

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Sync not needed - data fetched directly from APIs',
  });
}

export async function GET() {
  return NextResponse.json({
    configured: true,
    message: 'Running on Cloudflare Edge - no local sync needed',
  });
}
