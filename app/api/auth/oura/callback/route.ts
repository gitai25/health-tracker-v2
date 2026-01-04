import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const expectedState = request.cookies.get('oura_oauth_state')?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  // Skip state check if cookie wasn't preserved (common in some browsers)
  if (expectedState && state !== expectedState) {
    return NextResponse.redirect(new URL('/?error=state_mismatch', request.url));
  }

  try {
    const clientId = process.env.OURA_CLIENT_ID;
    const clientSecret = process.env.OURA_CLIENT_SECRET;
    const redirectUri = `${request.nextUrl.origin}/api/auth/oura/callback`;

    if (!clientId || !clientSecret) {
      return new NextResponse(
        `<html><body style="font-family:system-ui;padding:40px">
          <h2>配置错误</h2>
          <p>请在 Cloudflare Dashboard 设置环境变量：</p>
          <ul>
            <li>OURA_CLIENT_ID: ${clientId ? '✓ 已设置' : '✗ 未设置'}</li>
            <li>OURA_CLIENT_SECRET: ${clientSecret ? '✓ 已设置' : '✗ 未设置'}</li>
          </ul>
          <p><a href="/">返回首页</a></p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Oura doesn't require PKCE, skip it to avoid issues
    // if (usePkce && codeVerifier) {
    //   body.set('code_verifier', codeVerifier);
    // }

    const response = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Oura token error:', errorText);
      return new NextResponse(
        `<html><body style="font-family:system-ui;padding:40px">
          <h2>Token 获取失败</h2>
          <p>错误信息：${errorText}</p>
          <p>请检查：</p>
          <ul>
            <li>OURA_CLIENT_ID 和 OURA_CLIENT_SECRET 是否正确</li>
            <li>Redirect URI 是否设置为：${redirectUri}</li>
          </ul>
          <p><a href="/api/auth/oura">重新授权</a> | <a href="/">返回首页</a></p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const tokens = await response.json();

    // Return token info - user should add to Cloudflare Dashboard
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px;max-width:600px;margin:0 auto">
        <h2>Oura 授权成功</h2>
        <p>请将以下 Token 添加到 Cloudflare Dashboard 环境变量中：</p>
        <p><strong>OURA_ACCESS_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.access_token}</textarea>
        ${tokens.refresh_token ? `
        <p><strong>OURA_REFRESH_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.refresh_token}</textarea>
        ` : ''}
        <p><a href="/">返回首页</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Oura OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}
