import { NextRequest, NextResponse } from 'next/server';

export function requireAdmin(request: NextRequest): NextResponse | null {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return null;

  const header = request.headers.get('x-admin-token') ?? request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;

  if (token !== adminToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
