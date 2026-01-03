import type {
  WhoopRecovery,
  WhoopCycle,
  WhoopSleep,
  WhoopApiResponse,
} from './types';

const WHOOP_BASE_URL = 'https://api.prod.whoop.com/developer/v1';

export class WhoopClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<WhoopApiResponse<T>> {
    const url = new URL(`${WHOOP_BASE_URL}/${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
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

// Helper to create client from environment
export function createWhoopClient(): WhoopClient | null {
  const token = process.env.WHOOP_ACCESS_TOKEN;
  if (!token) return null;
  return new WhoopClient(token);
}
