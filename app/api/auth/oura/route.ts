import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';

// Redirect to Oura OAuth
export async function GET(request: NextRequest) {
  const clientId = process.env.OURA_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Oura client ID not configured' },
      { status: 500 }
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/oura/callback`;
  const scope = 'daily readiness heartrate workout tag session sleep';

  const authUrl = new URL(OURA_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', crypto.randomUUID());

  return NextResponse.redirect(authUrl.toString());
}

// Exchange code for token
export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json();

    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Oura OAuth not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Token exchange failed: ${error}` },
        { status: response.status }
      );
    }

    const tokens = await response.json();

    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    );
  }
}
