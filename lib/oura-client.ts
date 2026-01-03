import type {
  OuraReadiness,
  OuraSleep,
  OuraActivity,
  OuraApiResponse,
} from './types';

const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection';

export class OuraClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<OuraApiResponse<T>> {
    const url = new URL(`${OURA_BASE_URL}/${endpoint}`);
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
      throw new Error(`Oura API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getReadiness(
    startDate: string,
    endDate: string
  ): Promise<OuraReadiness[]> {
    const response = await this.fetch<OuraReadiness>('daily_readiness', {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  }

  async getSleep(startDate: string, endDate: string): Promise<OuraSleep[]> {
    const response = await this.fetch<OuraSleep>('daily_sleep', {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  }

  async getActivity(
    startDate: string,
    endDate: string
  ): Promise<OuraActivity[]> {
    const response = await this.fetch<OuraActivity>('daily_activity', {
      start_date: startDate,
      end_date: endDate,
    });
    return response.data;
  }

  async getAllData(
    startDate: string,
    endDate: string
  ): Promise<{
    readiness: OuraReadiness[];
    sleep: OuraSleep[];
    activity: OuraActivity[];
  }> {
    const [readiness, sleep, activity] = await Promise.all([
      this.getReadiness(startDate, endDate),
      this.getSleep(startDate, endDate),
      this.getActivity(startDate, endDate),
    ]);

    return { readiness, sleep, activity };
  }
}

// Helper to create client from environment
export function createOuraClient(): OuraClient | null {
  const token = process.env.OURA_ACCESS_TOKEN;
  if (!token) return null;
  return new OuraClient(token);
}
