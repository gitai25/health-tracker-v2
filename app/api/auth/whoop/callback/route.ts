import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const OAUTH_COOKIE_PATH = '/api/auth/whoop';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('whoop_oauth_state')?.value;
  const codeVerifier = request.cookies.get('whoop_pkce_verifier')?.value;
  const usePkce = process.env.OAUTH_USE_PKCE !== 'false';

  const clearCookies = (response: NextResponse) => {
    response.cookies.set('whoop_oauth_state', '', { maxAge: 0, path: OAUTH_COOKIE_PATH });
    response.cookies.set('whoop_pkce_verifier', '', { maxAge: 0, path: OAUTH_COOKIE_PATH });
  };

  if (error) {
    const response = NextResponse.redirect(new URL(`/?error=${error}`, request.url));
    clearCookies(response);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(new URL('/?error=no_code', request.url));
    clearCookies(response);
    return response;
  }

  if (!state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
    clearCookies(response);
    return response;
  }

  if (usePkce && !codeVerifier) {
    const response = NextResponse.redirect(new URL('/?error=missing_verifier', request.url));
    clearCookies(response);
    return response;
  }

  try {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/whoop/callback`;

    // Use client_secret_post method (credentials in body, not header)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId!,
      client_secret: clientSecret!,
    });
    if (usePkce && codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whoop token error:', error);
      const redirect = NextResponse.redirect(new URL(`/?error=token_failed`, request.url));
      clearCookies(redirect);
      return redirect;
    }

    const tokens = await response.json();

    // Save tokens to .env file
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add WHOOP_ACCESS_TOKEN
    if (envContent.includes('WHOOP_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /WHOOP_ACCESS_TOKEN=.*/,
        `WHOOP_ACCESS_TOKEN=${tokens.access_token}`
      );
    } else {
      envContent += `\nWHOOP_ACCESS_TOKEN=${tokens.access_token}`;
    }

    // Update or add WHOOP_REFRESH_TOKEN
    if (tokens.refresh_token) {
      if (envContent.includes('WHOOP_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /WHOOP_REFRESH_TOKEN=.*/,
          `WHOOP_REFRESH_TOKEN=${tokens.refresh_token}`
        );
      } else {
        envContent += `\nWHOOP_REFRESH_TOKEN=${tokens.refresh_token}`;
      }
    }

    fs.writeFileSync(envPath, envContent);

    // Also set in process.env for immediate use
    process.env.WHOOP_ACCESS_TOKEN = tokens.access_token;

    console.log('Whoop OAuth successful, token saved to .env');

    const redirect = NextResponse.redirect(new URL('/?whoop=connected', request.url));
    clearCookies(redirect);
    return redirect;
  } catch (error) {
    console.error('Whoop OAuth error:', error);
    const redirect = NextResponse.redirect(new URL(`/?error=oauth_failed`, request.url));
    clearCookies(redirect);
    return redirect;
  }
}
