import type {
  WhoopRecovery,
  WhoopCycle,
  WhoopSleep,
} from './types';
import type { D1Database } from './d1-client';
import { TokenStore } from './token-store';

const WHOOP_BASE_URL = 'https://api.prod.whoop.com/developer/v2';

interface WhoopV2Response<T> {
  records: T[];
  next_token?: string;
}

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

  private async fetchWithPagination<T>(
    endpoint: string,
    startDate: string
  ): Promise<T[]> {
    const token = await this.getValidToken();
    const startDateObj = new Date(startDate);
    const results: T[] = [];
    let nextToken: string | null = null;

    while (true) {
      const url = nextToken
        ? `${WHOOP_BASE_URL}/${endpoint}?nextToken=${encodeURIComponent(nextToken)}`
        : `${WHOOP_BASE_URL}/${endpoint}?limit=25`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Whoop API error: ${response.status} ${response.statusText}`);
      }

      const data: WhoopV2Response<T> = await response.json();

      if (data.records) {
        results.push(...data.records);
      }

      // Stop if we've gone past the start date
      const lastRecord = data.records?.[data.records.length - 1] as any;
      const recordDate = lastRecord?.start || lastRecord?.created_at;
      if (recordDate && new Date(recordDate) < startDateObj) {
        break;
      }

      nextToken = data.next_token || null;
      if (!nextToken) break;
    }

    return results;
  }

  async getRecovery(startDate: string, endDate: string): Promise<WhoopRecovery[]> {
    const allRecoveries = await this.fetchWithPagination<WhoopRecovery>('recovery', startDate);
    // Filter to date range
    return allRecoveries.filter((r) => {
      const date = r.created_at.split('T')[0];
      return date >= startDate && date <= endDate;
    });
  }

  async getCycles(startDate: string, endDate: string): Promise<WhoopCycle[]> {
    const allCycles = await this.fetchWithPagination<WhoopCycle>('cycle', startDate);
    // Filter to date range
    return allCycles.filter((c) => {
      const date = c.start.split('T')[0];
      return date >= startDate && date <= endDate;
    });
  }

  async getSleep(startDate: string, endDate: string): Promise<WhoopSleep[]> {
    const allSleep = await this.fetchWithPagination<WhoopSleep>('activity/sleep', startDate);
    // Filter to date range
    return allSleep.filter((s) => {
      const date = s.start.split('T')[0];
      return date >= startDate && date <= endDate;
    });
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
