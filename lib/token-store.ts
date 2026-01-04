import type { D1Database } from './d1-client';

export type Provider = 'whoop' | 'oura';

interface OAuthToken {
  id: number;
  provider: Provider;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

const TOKEN_URLS: Record<Provider, string> = {
  whoop: 'https://api.prod.whoop.com/oauth/oauth2/token',
  oura: 'https://api.ouraring.com/oauth/token',
};

// Buffer time before expiry to trigger refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export class TokenStore {
  constructor(private db: D1Database) {}

  async getToken(provider: Provider): Promise<OAuthToken | null> {
    const result = await this.db
      .prepare('SELECT * FROM oauth_tokens WHERE provider = ?')
      .bind(provider)
      .first<OAuthToken>();
    return result;
  }

  async saveToken(
    provider: Provider,
    accessToken: string,
    refreshToken?: string | null,
    expiresIn?: number
  ): Promise<void> {
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    await this.db
      .prepare(
        `INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(provider) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
           expires_at = excluded.expires_at,
           updated_at = CURRENT_TIMESTAMP`
      )
      .bind(provider, accessToken, refreshToken ?? null, expiresAt)
      .run();
  }

  async deleteToken(provider: Provider): Promise<void> {
    await this.db
      .prepare('DELETE FROM oauth_tokens WHERE provider = ?')
      .bind(provider)
      .run();
  }

  private isTokenExpired(token: OAuthToken): boolean {
    if (!token.expires_at) return false;
    const expiresAt = new Date(token.expires_at).getTime();
    return Date.now() + REFRESH_BUFFER_MS > expiresAt;
  }

  private async refreshToken(
    provider: Provider,
    refreshToken: string
  ): Promise<TokenRefreshResult | null> {
    const clientId =
      provider === 'whoop'
        ? process.env.WHOOP_CLIENT_ID
        : process.env.OURA_CLIENT_ID;
    const clientSecret =
      provider === 'whoop'
        ? process.env.WHOOP_CLIENT_SECRET
        : process.env.OURA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error(`${provider} OAuth credentials not configured`);
      return null;
    }

    try {
      const response = await fetch(TOKEN_URLS[provider], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`${provider} token refresh failed:`, error);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`${provider} token refresh error:`, error);
      return null;
    }
  }

  async getValidAccessToken(provider: Provider): Promise<string | null> {
    // First, try to get token from database
    let token = await this.getToken(provider);

    // If no token in DB, fall back to environment variable (for initial setup)
    if (!token) {
      const envToken =
        provider === 'whoop'
          ? process.env.WHOOP_ACCESS_TOKEN
          : process.env.OURA_ACCESS_TOKEN;

      if (envToken) {
        // Save env token to DB for future use
        const refreshToken =
          provider === 'whoop'
            ? process.env.WHOOP_REFRESH_TOKEN
            : process.env.OURA_REFRESH_TOKEN;
        await this.saveToken(provider, envToken, refreshToken);
        return envToken;
      }
      return null;
    }

    // Check if token is expired or about to expire
    if (this.isTokenExpired(token)) {
      if (!token.refresh_token) {
        console.error(`${provider} token expired and no refresh token available`);
        return null;
      }

      console.log(`${provider} token expired, refreshing...`);
      const newTokens = await this.refreshToken(provider, token.refresh_token);

      if (!newTokens) {
        // Refresh failed, token might be revoked
        console.error(`${provider} token refresh failed, please re-authorize`);
        return null;
      }

      // Save new tokens
      await this.saveToken(
        provider,
        newTokens.access_token,
        newTokens.refresh_token,
        newTokens.expires_in
      );

      console.log(`${provider} token refreshed successfully`);
      return newTokens.access_token;
    }

    return token.access_token;
  }
}

// Helper to create TokenStore from D1 binding
export function createTokenStore(db: D1Database): TokenStore {
  return new TokenStore(db);
}
