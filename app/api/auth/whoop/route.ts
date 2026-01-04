import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'edge';

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
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

// Redirect to Whoop OAuth
export async function GET(request: NextRequest) {
  const clientId = process.env.WHOOP_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Whoop client ID not configured' },
      { status: 500 }
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/whoop/callback`;
  const scope = 'offline read:recovery read:cycles read:sleep read:workout read:body_measurement';
  const state = crypto.randomUUID();
  const usePkce = process.env.OAUTH_USE_PKCE !== 'false';
  let codeVerifier: string | null = null;
  let codeChallenge: string | null = null;

  if (usePkce) {
    const pkce = await createPkcePair();
    codeVerifier = pkce.codeVerifier;
    codeChallenge = pkce.codeChallenge;
  }

  const authUrl = new URL(WHOOP_AUTH_URL);
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
  response.cookies.set('whoop_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: OAUTH_COOKIE_MAX_AGE,
    path: '/api/auth/whoop',
  });
  if (usePkce && codeVerifier) {
    response.cookies.set('whoop_pkce_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: OAUTH_COOKIE_MAX_AGE,
      path: '/api/auth/whoop',
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

    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Whoop OAuth not configured' },
        { status: 500 }
      );
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
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
