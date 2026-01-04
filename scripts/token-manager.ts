/**
 * Token Manager - Handles OAuth token refresh for Oura and Whoop
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.join(__dirname, '../.env');

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

// Load environment variables from .env file
export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...values] = line.split('=');
      if (key && !key.startsWith('#') && key.trim()) {
        env[key.trim()] = values.join('=').trim();
      }
    });
  }
  return env;
}

// Save a token to .env file
export function saveToken(key: string, value: string): void {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trim() + `\n${key}=${value}`;
  }

  fs.writeFileSync(ENV_FILE, content + '\n');
}

// Refresh Oura token
export async function refreshOuraToken(): Promise<string | null> {
  const env = loadEnv();
  const refreshToken = env.OURA_REFRESH_TOKEN;
  const clientId = env.OURA_CLIENT_ID;
  const clientSecret = env.OURA_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    console.log('Oura refresh token or credentials not configured');
    return null;
  }

  try {
    console.log('Refreshing Oura token...');
    const response = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Oura token refresh failed:', error);
      return null;
    }

    const tokens: TokenResponse = await response.json();

    // Save new tokens
    saveToken('OURA_ACCESS_TOKEN', tokens.access_token);
    if (tokens.refresh_token) {
      saveToken('OURA_REFRESH_TOKEN', tokens.refresh_token);
    }

    console.log('Oura token refreshed successfully');
    return tokens.access_token;
  } catch (error) {
    console.error('Oura token refresh error:', error);
    return null;
  }
}

// Refresh Whoop token
export async function refreshWhoopToken(): Promise<string | null> {
  const env = loadEnv();
  const refreshToken = env.WHOOP_REFRESH_TOKEN;
  const clientId = env.WHOOP_CLIENT_ID;
  const clientSecret = env.WHOOP_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    console.log('Whoop refresh token or credentials not configured');
    return null;
  }

  try {
    console.log('Refreshing Whoop token...');
    const response = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whoop token refresh failed:', error);
      return null;
    }

    const tokens: TokenResponse = await response.json();

    // Save new tokens
    saveToken('WHOOP_ACCESS_TOKEN', tokens.access_token);
    if (tokens.refresh_token) {
      saveToken('WHOOP_REFRESH_TOKEN', tokens.refresh_token);
    }

    console.log('Whoop token refreshed successfully');
    return tokens.access_token;
  } catch (error) {
    console.error('Whoop token refresh error:', error);
    return null;
  }
}

// Get valid Oura token (refresh if needed)
export async function getOuraToken(): Promise<string | null> {
  const env = loadEnv();
  let token = env.OURA_ACCESS_TOKEN;

  if (!token) {
    return refreshOuraToken();
  }

  // Test if token is valid
  try {
    const response = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      // Token expired, refresh it
      return refreshOuraToken();
    }

    return token;
  } catch {
    return refreshOuraToken();
  }
}

// Get valid Whoop token (refresh if needed)
export async function getWhoopToken(): Promise<string | null> {
  const env = loadEnv();
  let token = env.WHOOP_ACCESS_TOKEN;

  if (!token) {
    return refreshWhoopToken();
  }

  // Test if token is valid
  try {
    const response = await fetch('https://api.prod.whoop.com/developer/v1/cycle?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      // Token expired, refresh it
      return refreshWhoopToken();
    }

    return token;
  } catch {
    return refreshWhoopToken();
  }
}
