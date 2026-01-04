import type {
  WhoopRecovery,
  WhoopCycle,
  WhoopSleep,
  WhoopApiResponse,
} from './types';
import type { D1Database } from './d1-client';
import { TokenStore } from './token-store';

const WHOOP_BASE_URL = 'https://api.prod.whoop.com/developer/v1';

export class WhoopClient {
  private accessToken: string;
  private tokenStore?: TokenStore;

  constructor(accessToken: string, tokenStore?: TokenStore) {
    this.accessToken = accessToken;
    this.tokenStore = tokenStore;
  }

  private async getValidToken(): Promise<string> {
    if (this.tokenStore) {
      const token = await this.tokenStore.getValidAccessToken('whoop');
      if (token) {
        this.accessToken = token;
        return token;
      }
    }
    return this.accessToken;
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<WhoopApiResponse<T>> {
    // Get valid token (auto-refresh if expired)
    const token = await this.getValidToken();

    const url = new URL(`${WHOOP_BASE_URL}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Whoop API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getRecovery(
    startDate: string,
    endDate: string
  ): Promise<WhoopRecovery[]> {
    const response = await this.fetch<WhoopRecovery>('recovery', {
      start: startDate,
      end: endDate,
    });
    return response.records;
  }

  async getCycles(startDate: string, endDate: string): Promise<WhoopCycle[]> {
    const response = await this.fetch<WhoopCycle>('cycle', {
      start: startDate,
      end: endDate,
    });
    return response.records;
  }

  async getSleep(startDate: string, endDate: string): Promise<WhoopSleep[]> {
    const response = await this.fetch<WhoopSleep>('activity/sleep', {
      start: startDate,
      end: endDate,
    });
    return response.records;
  }

  async getAllData(
    startDate: string,
    endDate: string
  ): Promise<{
    recovery: WhoopRecovery[];
    cycles: WhoopCycle[];
    sleep: WhoopSleep[];
  }> {
    const [recovery, cycles, sleep] = await Promise.all([
      this.getRecovery(startDate, endDate),
      this.getCycles(startDate, endDate),
      this.getSleep(startDate, endDate),
    ]);

    return { recovery, cycles, sleep };
  }
}

// Helper to create client from environment (legacy, no auto-refresh)
export function createWhoopClient(): WhoopClient | null {
  const token = process.env.WHOOP_ACCESS_TOKEN;
  if (!token) return null;
  return new WhoopClient(token);
}

// Create client with D1 token store (auto-refresh enabled)
export async function createWhoopClientWithD1(
  db: D1Database
): Promise<WhoopClient | null> {
  const tokenStore = new TokenStore(db);
  const token = await tokenStore.getValidAccessToken('whoop');
  if (!token) return null;
  return new WhoopClient(token, tokenStore);
}
