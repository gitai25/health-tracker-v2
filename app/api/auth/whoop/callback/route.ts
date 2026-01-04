import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('whoop_oauth_state')?.value;
  const codeVerifier = request.cookies.get('whoop_pkce_verifier')?.value;
  const usePkce = process.env.OAUTH_USE_PKCE !== 'false';

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
  }

  try {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/whoop/callback`;

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      console.error('Whoop token error:', await response.text());
      return NextResponse.redirect(new URL('/?error=token_failed', request.url));
    }

    const tokens = await response.json();

    // Return token info - user should add to Cloudflare Dashboard
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px;max-width:600px;margin:0 auto">
        <h2>Whoop 授权成功</h2>
        <p>请将以下 Token 添加到 Cloudflare Dashboard 环境变量中：</p>
        <p><strong>WHOOP_ACCESS_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.access_token}</textarea>
        ${tokens.refresh_token ? `
        <p><strong>WHOOP_REFRESH_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.refresh_token}</textarea>
        ` : ''}
        <p><a href="/">返回首页</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Whoop OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}
