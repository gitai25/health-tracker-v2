import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'edge';

const OURA_AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OAUTH_COOKIE_MAX_AGE = 10 * 60;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createPkcePair(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64UrlEncode(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));
  return { codeVerifier, codeChallenge };
}

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
  const state = crypto.randomUUID();
  const usePkce = process.env.OAUTH_USE_PKCE !== 'false';
  let codeVerifier: string | null = null;
  let codeChallenge: string | null = null;

  if (usePkce) {
    const pkce = await createPkcePair();
    codeVerifier = pkce.codeVerifier;
    codeChallenge = pkce.codeChallenge;
  }

  const authUrl = new URL(OURA_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  if (usePkce && codeChallenge) {
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('oura_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: '/api/auth/oura',
  });
  if (usePkce && codeVerifier) {
    response.cookies.set('oura_pkce_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: OAUTH_COOKIE_MAX_AGE,
      path: '/api/auth/oura',
    });
  }

  return response;
}

// Exchange code for token
export async function POST(request: NextRequest) {
  try {
    if (process.env.ENABLE_TOKEN_EXCHANGE_API !== 'true') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

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
