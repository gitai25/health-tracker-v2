import * as fs from 'fs';
import * as path from 'path';
import type { WeeklyHealthData } from './types';

const DATA_FILE = path.join(process.cwd(), 'data/health-data.json');

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

// Load data from local JSON file
export function loadLocalData(): HealthData | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading local data:', error);
  }
  return null;
}

// Get week number
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Determine zone based on MET-minutes
function determineZone(metMinutes: number | null, recovery: number | null): string {
  if (metMinutes !== null) {
    if (metMinutes > 1500) return 'J型右侧风险';
    if (metMinutes > 1400) return '右侧临界';
    if (metMinutes > 1300) return '高负荷';
    if (metMinutes > 1200) return '轻度高负荷';
    if (metMinutes > 1100) return '稍高';
    if (recovery !== null && recovery >= 67 && metMinutes >= 1000 && metMinutes <= 1100) {
      return '黄金锚点';
    }
    if (metMinutes >= 900 && metMinutes <= 1200) return '最优区';
    if (metMinutes < 900) return '恢复稳态';
  }
  return '恢复稳态';
}

// Helper to calculate daily MET contribution (kJ / 52 for that day)
function calculateDailyMet(kj: number | null): number | null {
  return kj !== null ? Math.round(kj / 52) : null;
}

// Convert local data to weekly format
export function processLocalData(data: HealthData): WeeklyHealthData[] {
  const dailyMap = new Map<string, DailyData>();

  // Group by date
  for (const item of data.daily) {
    dailyMap.set(item.date, item);
  }

  // Group into weeks (merge week 53 and week 1 if they're the same continuous week)
  const weekMap = new Map<string, DailyData[]>();

  for (const [date, item] of dailyMap) {
    const d = new Date(date);
    const year = d.getFullYear();
    const week = getWeekNumber(d);

    // For week 1 of a new year, check if it should merge with week 53 of previous year
    // Week 1 days that fall in early January (before ~Jan 4) belong to the same week as late December
    let key: string;
    if (week === 1 && d.getMonth() === 0 && d.getDate() <= 4) {
      // This is actually part of week 53 of the previous year
      key = `${year - 1}-W53`;
    } else if (week >= 52 && d.getMonth() === 11 && d.getDate() >= 29) {
      // Late December - use week 53 key for consistency
      key = `${year}-W53`;
    } else {
      key = `${year}-W${week}`;
    }

    if (!weekMap.has(key)) {
      weekMap.set(key, []);
    }
    weekMap.get(key)!.push(item);
  }

  // Convert to WeeklyHealthData
  const result: WeeklyHealthData[] = [];

  // Sort week keys by date descending
  const sortedWeekKeys = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a));

  for (const key of sortedWeekKeys) {
    const days = weekMap.get(key)!;
    days.sort((a, b) => a.date.localeCompare(b.date));

    const firstDay = new Date(days[0].date);
    const lastDay = new Date(days[days.length - 1].date);
    // For cross-year weeks (Dec-Jan), use the latest day's week number (Week 1)
    const isCrossYearWeek = firstDay.getFullYear() !== lastDay.getFullYear();
    const weekNum = isCrossYearWeek ? 1 : getWeekNumber(firstDay);

    // Calculate week totals
    const readinessScores = days
      .map(d => d.oura?.readiness_score)
      .filter((v): v is number => v !== null && v !== undefined);
    const recoveryScores = days
      .map(d => d.whoop?.recovery_score ?? d.oura?.readiness_score)
      .filter((v): v is number => v !== null && v !== undefined);
    const sleepScores = days
      .map(d => d.oura?.sleep_score ?? d.whoop?.sleep_performance)
      .filter((v): v is number => v !== null && v !== undefined);
    const hrvOuraValues = days
      .map(d => d.oura?.hrv)
      .filter((v): v is number => v !== null && v !== undefined);
    const hrvWhoopValues = days
      .map(d => d.whoop?.hrv)
      .filter((v): v is number => v !== null && v !== undefined);
    const hrvValues = [...hrvOuraValues, ...hrvWhoopValues];
    const stepsValues = days
      .map(d => d.oura?.steps)
      .filter((v): v is number => v !== null && v !== undefined);
    const kilojouleValues = days
      .map(d => d.whoop?.kilojoule)
      .filter((v): v is number => v !== null && v !== undefined);

    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const sum = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

    const avg_readiness = avg(readinessScores);
    const avg_recovery = avg(recoveryScores);
    const avg_sleep = avg(sleepScores);
    const avg_hrv = avg(hrvValues);
    const avg_hrv_oura = avg(hrvOuraValues);
    const avg_hrv_whoop = hrvWhoopValues.length > 0 ? Math.round(hrvWhoopValues.reduce((a, b) => a + b, 0) / hrvWhoopValues.length) : null;
    const avg_steps = avg(stepsValues);
    const total_kilojoule = sum(kilojouleValues);
    const total_met_minutes = total_kilojoule !== null ? Math.round(total_kilojoule / 52) : null;

    const isCurrentWeek = isInCurrentWeek(firstDay);
    const daysCount = days.length;
    const isIncompleteWeek = daysCount < 7;

    if (isIncompleteWeek) {
      // For incomplete weeks: first row is cumulative, then each day

      // 1. Add cumulative row for the week
      result.push({
        week: `Week ${weekNum}`,
        date_range: `${formatDate(firstDay)} - ${formatDate(lastDay)}`,
        start_date: days[0].date,
        end_date: days[days.length - 1].date,
        daily_data: [],
        days_count: daysCount,
        avg_readiness,
        avg_recovery,
        avg_sleep,
        avg_hrv,
        avg_hrv_oura,
        avg_hrv_whoop,
        avg_steps,
        total_strain: null,
        total_met_minutes,
        zone: determineZone(total_met_minutes, avg_recovery),
        trend: '→',
        health_status: '健康',
        row_type: 'week_cumulative',
      });

      // 2. Add daily rows (most recent first)
      let cumulativeKj = 0;
      const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));

      for (const day of sortedDays) {
        const dayDate = new Date(day.date);
        const dayKj = day.whoop?.kilojoule ?? 0;

        // Calculate cumulative from this day backwards
        const daysUpToThis = days.filter(d => d.date <= day.date);
        const cumulativeKjUpToThis = daysUpToThis.reduce((acc, d) => acc + (d.whoop?.kilojoule ?? 0), 0);
        const cumulativeMet = Math.round(cumulativeKjUpToThis / 52);

        result.push({
          week: `  ${formatDateFull(dayDate)}`,
          date_range: getDayOfWeek(dayDate),
          start_date: day.date,
          end_date: day.date,
          daily_data: [],
          days_count: 1,
          avg_readiness: day.oura?.readiness_score ?? null,
          avg_recovery: day.whoop?.recovery_score ?? day.oura?.readiness_score ?? null,
          avg_sleep: day.oura?.sleep_score ?? day.whoop?.sleep_performance ?? null,
          avg_hrv: day.oura?.hrv ?? day.whoop?.hrv ?? null,
          avg_hrv_oura: day.oura?.hrv ?? null,
          avg_hrv_whoop: day.whoop?.hrv ? Math.round(day.whoop.hrv) : null,
          avg_steps: day.oura?.steps ?? null,
          total_strain: day.whoop?.strain ?? null,
          total_met_minutes: calculateDailyMet(day.whoop?.kilojoule ?? null),
          cumulative_met_minutes: cumulativeMet,
          zone: '-',
          trend: '→',
          health_status: '健康',
          row_type: 'day',
        });
      }
    } else {
      // Complete week - single row
      result.push({
        week: `Week ${weekNum}`,
        date_range: `${formatDate(firstDay)} - ${formatDate(lastDay)}`,
        start_date: days[0].date,
        end_date: days[days.length - 1].date,
        daily_data: [],
        days_count: daysCount,
        avg_readiness,
        avg_recovery,
        avg_sleep,
        avg_hrv,
        avg_hrv_oura,
        avg_hrv_whoop,
        avg_steps,
        total_strain: null,
        total_met_minutes,
        zone: determineZone(total_met_minutes, avg_recovery),
        trend: '→',
        health_status: '健康',
        row_type: 'week',
      });
    }
  }

  // Calculate trends for week rows
  const weekRows = result.filter(r => r.row_type === 'week' || r.row_type === 'week_cumulative');
  for (let i = 0; i < weekRows.length - 1; i++) {
    const curr = weekRows[i];
    const prev = weekRows[i + 1];
    if (curr.avg_recovery !== null && prev.avg_recovery !== null) {
      const diff = curr.avg_recovery - prev.avg_recovery;
      curr.trend = diff > 5 ? '↑' : diff < -5 ? '↓' : '→';
    }
  }

  return result;
}

function formatDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateFull(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDayOfWeek(date: Date): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[date.getDay()];
}

function isInCurrentWeek(date: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return date >= startOfWeek;
}

// Check if we have Oura/Whoop data
export function checkDataSources(data: HealthData): { oura: boolean; whoop: boolean } {
  let hasOura = false;
  let hasWhoop = false;

  for (const item of data.daily) {
    if (item.oura && (item.oura.readiness_score !== null || item.oura.met_minutes !== null)) {
      hasOura = true;
    }
    if (item.whoop && (item.whoop.recovery_score !== null || item.whoop.strain !== null)) {
      hasWhoop = true;
    }
    if (hasOura && hasWhoop) break;
  }

  return { oura: hasOura, whoop: hasWhoop };
}
