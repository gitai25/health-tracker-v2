import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';

const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OAUTH_COOKIE_PATH = '/api/auth/oura';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('oura_oauth_state')?.value;
  const codeVerifier = request.cookies.get('oura_pkce_verifier')?.value;
  const usePkce = process.env.OAUTH_USE_PKCE !== 'false';

  const clearCookies = (response: NextResponse) => {
    response.cookies.set('oura_oauth_state', '', { maxAge: 0, path: OAUTH_COOKIE_PATH });
    response.cookies.set('oura_pkce_verifier', '', { maxAge: 0, path: OAUTH_COOKIE_PATH });
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
    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/oura/callback`;

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

    const response = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Oura token error:', error);
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

    // Update or add OURA_ACCESS_TOKEN
    if (envContent.includes('OURA_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /OURA_ACCESS_TOKEN=.*/,
        `OURA_ACCESS_TOKEN=${tokens.access_token}`
      );
    } else {
      envContent += `\nOURA_ACCESS_TOKEN=${tokens.access_token}`;
    }

    // Update or add OURA_REFRESH_TOKEN
    if (tokens.refresh_token) {
      if (envContent.includes('OURA_REFRESH_TOKEN=')) {
        envContent = envContent.replace(
          /OURA_REFRESH_TOKEN=.*/,
          `OURA_REFRESH_TOKEN=${tokens.refresh_token}`
        );
      } else {
        envContent += `\nOURA_REFRESH_TOKEN=${tokens.refresh_token}`;
      }
    }

    fs.writeFileSync(envPath, envContent);

    // Also set in process.env for immediate use
    process.env.OURA_ACCESS_TOKEN = tokens.access_token;

    console.log('Oura OAuth successful, token saved to .env');

    const redirect = NextResponse.redirect(new URL('/?oura=connected', request.url));
    clearCookies(redirect);
    return redirect;
  } catch (error) {
    console.error('Oura OAuth error:', error);
    const redirect = NextResponse.redirect(new URL(`/?error=oauth_failed`, request.url));
    clearCookies(redirect);
    return redirect;
  }
}
