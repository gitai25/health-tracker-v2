#!/usr/bin/env npx ts-node

/**
 * Daily sync script for health data
 * Run via cron: 0 9 * * * cd /Users/ai2025/health-tracker-v2 && npx ts-node scripts/sync.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '../data/health-data.json');
const ENV_FILE = path.join(__dirname, '../.env');

interface DailyData {
  date: string;
  oura?: {
    readiness_score: number | null;
    sleep_score: number | null;
    activity_score: number | null;
    met_minutes: number | null;
    steps: number | null;
    hrv: number | null;
  };
  whoop?: {
    recovery_score: number | null;
    strain: number | null;
    sleep_performance: number | null;
    hrv: number | null;
    rhr: number | null;
    kilojoule: number | null;
    met_minutes: number | null;
  };
}

interface HealthData {
  last_sync: string;
  daily: DailyData[];
}

// ============ Token Manager ============

function loadEnv(): Record<string, string> {
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

function saveToken(key: string, value: string): void {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf-8') : '';

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content = content.trim() + `\n${key}=${value}`;
  }

  fs.writeFileSync(ENV_FILE, content + '\n');
}

async function refreshOuraToken(): Promise<string | null> {
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
      console.error('Oura token refresh failed:', error);
      return null;
    }

    const tokens = await response.json();
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

async function refreshWhoopToken(): Promise<string | null> {
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
      console.error('Whoop token refresh failed:', error);
      return null;
    }

    const tokens = await response.json();
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

async function getOuraToken(): Promise<string | null> {
  const env = loadEnv();
  const token = env.OURA_ACCESS_TOKEN;

  if (!token) {
    return refreshOuraToken();
  }

  // Test if token is valid
  try {
    const response = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return refreshOuraToken();
    }

    return token;
  } catch {
    return refreshOuraToken();
  }
}

async function getWhoopToken(): Promise<string | null> {
  const env = loadEnv();
  const token = env.WHOOP_ACCESS_TOKEN;

  if (!token) {
    return refreshWhoopToken();
  }

  // Test if token is valid
  try {
    const response = await fetch('https://api.prod.whoop.com/developer/v1/cycle?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return refreshWhoopToken();
    }

    return token;
  } catch {
    return refreshWhoopToken();
  }
}

// ============ Data Fetching ============

async function fetchOuraData(startDate: string, endDate: string): Promise<Map<string, DailyData['oura']>> {
  const token = await getOuraToken();
  if (!token) {
    console.log('No Oura access token available');
    return new Map();
  }

  const results = new Map<string, DailyData['oura']>();

  try {
    // Fetch all data in parallel
    const [readinessRes, activityRes, sleepRes, sleepDetailRes] = await Promise.all([
      fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      // Get detailed sleep data which includes actual HRV in ms
      fetch(`https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const [readinessData, activityData, sleepData, sleepDetailData] = await Promise.all([
      readinessRes.json(),
      activityRes.json(),
      sleepRes.json(),
      sleepDetailRes.json(),
    ]);

    // Build HRV map from detailed sleep data (actual ms values)
    const hrvMap = new Map<string, number>();
    for (const item of sleepDetailData.data || []) {
      const day = item.day;
      if (item.average_hrv && day) {
        hrvMap.set(day, Math.round(item.average_hrv));
      }
    }

    // Process readiness
    for (const item of readinessData.data || []) {
      results.set(item.day, {
        readiness_score: item.score,
        sleep_score: null,
        activity_score: null,
        met_minutes: null,
        steps: null,
        hrv: hrvMap.get(item.day) ?? null,
      });
    }

    // Process activity
    for (const item of activityData.data || []) {
      const existing = results.get(item.day) || {
        readiness_score: null,
        sleep_score: null,
        activity_score: null,
        met_minutes: null,
        steps: null,
        hrv: hrvMap.get(item.day) ?? null,
      };
      existing.activity_score = item.score;
      // Only count MVPA (Moderate-Vigorous Physical Activity)
      // Exclude low_activity which is just light movement (standing, slow walking)
      existing.met_minutes =
        (item.high_activity_met_minutes || 0) +
        (item.medium_activity_met_minutes || 0);
      existing.steps = item.steps;
      results.set(item.day, existing);
    }

    // Process sleep
    for (const item of sleepData.data || []) {
      const existing = results.get(item.day) || {
        readiness_score: null,
        sleep_score: null,
        activity_score: null,
        met_minutes: null,
        steps: null,
        hrv: hrvMap.get(item.day) ?? null,
      };
      existing.sleep_score = item.score;
      if (!existing.hrv) {
        existing.hrv = hrvMap.get(item.day) ?? null;
      }
      results.set(item.day, existing);
    }

    console.log(`Fetched ${results.size} days of Oura data`);
  } catch (error) {
    console.error('Oura fetch error:', error);
  }

  return results;
}

async function fetchWhoopData(startDate: string, endDate: string): Promise<Map<string, DailyData['whoop']>> {
  const token = await getWhoopToken();
  if (!token) {
    console.log('No Whoop access token available');
    return new Map();
  }

  const results = new Map<string, DailyData['whoop']>();
  const startDateObj = new Date(startDate);

  try {
    // Use v2 API - fetch cycles and recovery separately then merge
    const allCycles: any[] = [];
    const allRecoveries: any[] = [];

    // Fetch cycles with pagination (v2 API)
    let nextToken: string | null = null;
    while (true) {
      const cycleUrl: string = nextToken
        ? `https://api.prod.whoop.com/developer/v2/cycle?nextToken=${encodeURIComponent(nextToken)}`
        : 'https://api.prod.whoop.com/developer/v2/cycle?limit=25';

      const cyclesRes: Response = await fetch(cycleUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cyclesData: any = await cyclesRes.json();

      if (cyclesData.records) {
        allCycles.push(...cyclesData.records);
      }

      // Stop if we've gone past the start date
      const lastRecord = cyclesData.records?.[cyclesData.records.length - 1];
      if (lastRecord && new Date(lastRecord.start) < startDateObj) {
        break;
      }

      nextToken = cyclesData.next_token || null;
      if (!nextToken) break;
    }

    // Fetch recovery data (v2 API - returns all recoveries)
    nextToken = null;
    while (true) {
      const recoveryUrl: string = nextToken
        ? `https://api.prod.whoop.com/developer/v2/recovery?nextToken=${encodeURIComponent(nextToken)}`
        : 'https://api.prod.whoop.com/developer/v2/recovery?limit=25';

      const recoveryRes: Response = await fetch(recoveryUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!recoveryRes.ok) break;

      const recoveryData: any = await recoveryRes.json();

      if (recoveryData.records) {
        allRecoveries.push(...recoveryData.records);
      }

      // Stop if we've gone past the start date
      const lastRecord = recoveryData.records?.[recoveryData.records.length - 1];
      if (lastRecord && new Date(lastRecord.created_at) < startDateObj) {
        break;
      }

      nextToken = recoveryData.next_token || null;
      if (!nextToken) break;
    }

    // Build recovery map by cycle_id
    const recoveryMap = new Map<number, any>();
    for (const rec of allRecoveries) {
      if (rec.cycle_id) {
        recoveryMap.set(rec.cycle_id, rec);
      }
    }

    // Merge cycles with recovery data
    // Recovery is shifted by 1 day: cycle started on day N has recovery for waking up on day N+1
    for (const cycle of allCycles) {
      const cycleDate = cycle.start?.split('T')[0];
      if (!cycleDate) continue;

      const kilojoule = cycle.score?.kilojoule ?? null;
      const recovery = recoveryMap.get(cycle.id);

      // Strain and kilojoule stay on cycle date
      if (cycleDate >= startDate && cycleDate <= endDate) {
        const existing = results.get(cycleDate) || {
          recovery_score: null,
          strain: null,
          sleep_performance: null,
          hrv: null,
          rhr: null,
          kilojoule: null,
          met_minutes: null,
        };
        existing.strain = cycle.score?.strain ?? null;
        existing.kilojoule = kilojoule;
        results.set(cycleDate, existing);
      }

      // Recovery shifts to next day (wake-up date)
      if (recovery) {
        const nextDay = new Date(cycleDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const wakeUpDate = nextDay.toISOString().split('T')[0];

        if (wakeUpDate >= startDate && wakeUpDate <= endDate) {
          const existing = results.get(wakeUpDate) || {
            recovery_score: null,
            strain: null,
            sleep_performance: null,
            hrv: null,
            rhr: null,
            kilojoule: null,
            met_minutes: null,
          };
          existing.recovery_score = recovery.score?.recovery_score ?? null;
          existing.hrv = recovery.score?.hrv_rmssd_milli ?? null;
          existing.rhr = recovery.score?.resting_heart_rate ?? null;
          results.set(wakeUpDate, existing);
        }
      }
    }

    console.log(`Fetched ${results.size} days of Whoop data (v2 API)`);
  } catch (error) {
    console.error('Whoop fetch error:', error);
  }

  return results;
}

// ============ Data Storage ============

function loadData(): HealthData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading data:', error);
  }
  return { last_sync: '', daily: [] };
}

function saveData(data: HealthData) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`Saved data to ${DATA_FILE}`);
}

function getDateRange(days: number = 90): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

// ============ Main ============

async function sync() {
  console.log('Starting health data sync...');
  console.log(`Time: ${new Date().toISOString()}`);

  const { start, end } = getDateRange(90);
  console.log(`Date range: ${start} to ${end}`);

  // Fetch data from both sources
  const [ouraData, whoopData] = await Promise.all([
    fetchOuraData(start, end),
    fetchWhoopData(start, end),
  ]);

  // Load existing data
  const existingData = loadData();
  const dailyMap = new Map<string, DailyData>();

  // Add existing data to map
  for (const item of existingData.daily) {
    dailyMap.set(item.date, item);
  }

  // Merge new Oura data
  for (const [date, oura] of ouraData) {
    const existing = dailyMap.get(date) || { date };
    existing.oura = oura;
    dailyMap.set(date, existing);
  }

  // Merge new Whoop data
  for (const [date, whoop] of whoopData) {
    const existing = dailyMap.get(date) || { date };
    existing.whoop = whoop;
    dailyMap.set(date, existing);
  }

  // Sort by date
  const daily = Array.from(dailyMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Save
  const newData: HealthData = {
    last_sync: new Date().toISOString(),
    daily,
  };
  saveData(newData);

  console.log(`Sync complete. Total ${daily.length} days of data.`);
}

// Run
sync().catch(console.error);
