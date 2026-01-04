import { NextRequest, NextResponse } from 'next/server';
import { TokenStore } from '@/lib/token-store';
import type { D1Database } from '@/lib/d1-client';

export const runtime = 'edge';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

interface CloudflareEnv {
  DB: D1Database;
}

// Get D1 from Cloudflare context
function getD1(): D1Database | undefined {
  return (process.env as unknown as CloudflareEnv).DB;
}

export async function GET(request: NextRequest) {
  const db = getD1();
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

    // Check if credentials are configured
    if (!clientId || !clientSecret) {
      return new NextResponse(
        `<html><body style="font-family:system-ui;padding:40px">
          <h2>配置错误</h2>
          <p>请在 Cloudflare Dashboard 设置环境变量：</p>
          <ul>
            <li>WHOOP_CLIENT_ID: ${clientId ? '✓ 已设置' : '✗ 未设置'}</li>
            <li>WHOOP_CLIENT_SECRET: ${clientSecret ? '✓ 已设置' : '✗ 未设置'}</li>
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

    if (usePkce && codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whoop token error:', errorText);
      return new NextResponse(
        `<html><body style="font-family:system-ui;padding:40px">
          <h2>Token 获取失败</h2>
          <p>错误信息：${errorText}</p>
          <p>请检查：</p>
          <ul>
            <li>WHOOP_CLIENT_ID 和 WHOOP_CLIENT_SECRET 是否正确</li>
            <li>Redirect URI 是否设置为：${redirectUri}</li>
          </ul>
          <p><a href="/api/auth/whoop">重新授权</a> | <a href="/">返回首页</a></p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const tokens = await response.json();

    // Save tokens to D1 database for auto-refresh
    let savedToDb = false;
    if (db) {
      try {
        const tokenStore = new TokenStore(db);
        await tokenStore.saveToken(
          'whoop',
          tokens.access_token,
          tokens.refresh_token,
          tokens.expires_in
        );
        savedToDb = true;
      } catch (e) {
        console.error('Failed to save tokens to D1:', e);
      }
    }

    // Return success page
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:40px;max-width:600px;margin:0 auto">
        <h2>Whoop 授权成功</h2>
        ${savedToDb ? `
        <p style="color:green">Token 已自动保存到数据库，支持自动刷新。</p>
        ` : `
        <p>请将以下 Token 添加到 Cloudflare Dashboard 环境变量中：</p>
        <p><strong>WHOOP_ACCESS_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.access_token}</textarea>
        ${tokens.refresh_token ? `
        <p><strong>WHOOP_REFRESH_TOKEN:</strong></p>
        <textarea readonly style="width:100%;height:80px;font-size:12px">${tokens.refresh_token}</textarea>
        ` : ''}
        `}
        <p><a href="/">返回首页</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Whoop OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
  }
}
