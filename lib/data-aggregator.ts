import type {
  DailyHealthData,
  WeeklyHealthData,
  OuraReadiness,
  OuraSleep,
  OuraActivity,
  WhoopRecovery,
  WhoopCycle,
  WhoopSleep,
} from './types';

// Determine zone based on MET-minutes and recovery
// MET-min zones: 900-1200 optimal, 1050 golden anchor
function determineZone(
  metMinutes: number | null,
  recovery: number | null,
  strain: number | null
): string {
  // If we have MET-minutes (from Oura), use that
  if (metMinutes !== null) {
    if (metMinutes > 1500) return 'J型右侧风险';
    if (metMinutes > 1400) return '右侧临界';
    if (metMinutes > 1300) return '高负荷';
    if (metMinutes > 1200) return '轻度高负荷';
    if (metMinutes > 1100) return '稍高';

    if (recovery !== null) {
      if (recovery >= 67 && metMinutes >= 1000 && metMinutes <= 1100) return '黄金锚点';
      if (recovery >= 67 && metMinutes >= 900 && metMinutes <= 1200) return '最优区';
      if (recovery < 34) return '恢复稳态';
    }

    if (metMinutes >= 900 && metMinutes <= 1200) return '最优区';
    if (metMinutes < 900) return '恢复稳态';
  }

  // Fallback to Whoop strain if no MET-minutes
  if (strain !== null) {
    if (strain > 18) return 'J型右侧风险';
    if (strain > 16) return '右侧临界';
    if (strain > 14) return '高负荷';
    if (strain > 12) return '轻度高负荷';
    if (strain > 10) return '稍高';

    if (recovery !== null) {
      if (recovery >= 67 && strain >= 8 && strain <= 12) return '黄金锚点';
      if (recovery >= 67) return '最优区';
      if (recovery < 34) return '恢复稳态';
    }
  }

  return '恢复稳态';
}

// Determine trend based on recent data
function determineTrend(
  current: number | null,
  previous: number | null
): string {
  if (current === null || previous === null) return '→';
  const diff = current - previous;
  if (diff > 5) return '↑';
  if (diff < -5) return '↓';
  return '→';
}

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get week number
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Aggregate daily data from Oura and Whoop
export function aggregateDailyData(
  date: string,
  ouraReadiness: OuraReadiness | undefined,
  ouraSleep: OuraSleep | undefined,
  ouraActivity: OuraActivity | undefined,
  whoopRecovery: WhoopRecovery | undefined,
  whoopCycle: WhoopCycle | undefined,
  whoopSleep: WhoopSleep | undefined
): DailyHealthData {
  // Extract HRV (prefer Whoop as it's more precise)
  const hrv =
    whoopRecovery?.score?.hrv_rmssd_milli ??
    (ouraReadiness?.contributors.hrv_balance
      ? ouraReadiness.contributors.hrv_balance
      : null);

  // Extract RHR
  const rhr =
    whoopRecovery?.score?.resting_heart_rate ??
    (ouraReadiness?.contributors.resting_heart_rate ?? null);

  // Readiness score (Oura specific)
  const readiness_score = ouraReadiness?.score ?? null;

  // Recovery score (Whoop specific, or derive from Oura readiness)
  const recovery_score =
    whoopRecovery?.score?.recovery_score ?? ouraReadiness?.score ?? null;

  // Sleep score (average of both if available)
  const ouraSleepScore = ouraSleep?.score ?? null;
  const whoopSleepPerf =
    whoopSleep?.score?.sleep_performance_percentage ?? null;
  const sleep_score =
    ouraSleepScore !== null && whoopSleepPerf !== null
      ? Math.round((ouraSleepScore + whoopSleepPerf) / 2)
      : ouraSleepScore ?? whoopSleepPerf;

  // Strain (Whoop specific)
  const strain = whoopCycle?.score?.strain ?? null;

  // Steps (Oura specific)
  const steps = ouraActivity?.steps ?? null;

  // Kilojoules (Whoop specific)
  const kilojoule = whoopCycle?.score?.kilojoule ?? null;

  // MET-minutes calculation:
  // - Oura: sum of high, medium, low activity MET-minutes
  // - Whoop: convert kilojoules to MET-minutes (kJ / 52)
  let met_minutes: number | null = null;
  if (ouraActivity) {
    met_minutes =
      (ouraActivity.high_activity_met_minutes ?? 0) +
      (ouraActivity.medium_activity_met_minutes ?? 0) +
      (ouraActivity.low_activity_met_minutes ?? 0);
  } else if (kilojoule !== null) {
    // Convert Whoop kilojoules to MET-minutes
    met_minutes = Math.round(kilojoule / 52);
  }

  // Determine zone based on MET-minutes, recovery, and strain
  const zone = determineZone(met_minutes, recovery_score, strain);

  return {
    date,
    oura: {
      readiness: ouraReadiness ?? null,
      sleep: ouraSleep ?? null,
      activity: ouraActivity ?? null,
    },
    whoop: {
      recovery: whoopRecovery ?? null,
      strain: whoopCycle ?? null,
      sleep: whoopSleep ?? null,
    },
    combined: {
      readiness_score,
      recovery_score,
      sleep_score,
      hrv,
      rhr,
      strain,
      steps,
      met_minutes,
      zone,
      trend: '→', // Will be computed when we have multiple days
      health_status: '健康',
    },
  };
}

// Aggregate weekly data
export function aggregateWeeklyData(
  dailyData: DailyHealthData[]
): WeeklyHealthData {
  if (dailyData.length === 0) {
    throw new Error('No daily data provided');
  }

  const dates = dailyData.map((d) => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const weekNum = getWeekNumber(startDate);

  // Calculate averages
  const readinessScores = dailyData
    .map((d) => d.combined.readiness_score)
    .filter((s): s is number => s !== null);
  const recoveryScores = dailyData
    .map((d) => d.combined.recovery_score)
    .filter((s): s is number => s !== null);
  const sleepScores = dailyData
    .map((d) => d.combined.sleep_score)
    .filter((s): s is number => s !== null);
  const hrvValues = dailyData
    .map((d) => d.combined.hrv)
    .filter((s): s is number => s !== null);
  const stepsValues = dailyData
    .map((d) => d.combined.steps)
    .filter((s): s is number => s !== null);
  const strainValues = dailyData
    .map((d) => d.combined.strain)
    .filter((s): s is number => s !== null);
  const metMinutesValues = dailyData
    .map((d) => d.combined.met_minutes)
    .filter((s): s is number => s !== null);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const sum = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) : null;

  const avg_readiness = avg(readinessScores);
  const avg_recovery = avg(recoveryScores);
  const avg_sleep = avg(sleepScores);
  const avg_hrv = avg(hrvValues);
  const avg_steps = avg(stepsValues);
  const total_strain = sum(strainValues);
  const total_met_minutes = sum(metMinutesValues);

  // Determine weekly zone based on average daily MET-minutes
  const avgDailyMetMin = total_met_minutes !== null ? total_met_minutes / dailyData.length : null;
  const avgDailyStrain = total_strain !== null ? total_strain / dailyData.length : null;
  const zone = determineZone(avgDailyMetMin, avg_recovery, avgDailyStrain);

  return {
    week: `Week ${weekNum}`,
    date_range: `${formatDate(startDate).slice(5)} - ${formatDate(endDate).slice(5)}`,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    daily_data: dailyData,
    avg_readiness,
    avg_recovery,
    avg_sleep,
    avg_hrv,
    avg_steps,
    total_strain,
    total_met_minutes,
    zone,
    trend: '→', // Will be computed with previous week data
    health_status: '健康',
  };
}

// Group data by date for easier lookup
export function groupByDate<T extends { day?: string; start?: string }>(
  items: T[],
  dateField: 'day' | 'start' = 'day'
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const date = dateField === 'day' ? (item as { day: string }).day : (item as { start: string }).start?.split('T')[0];
    if (date) {
      map.set(date, item);
    }
  }
  return map;
}

// Generate date range
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Generate daily health data from API responses
export function generateDailyData(
  ouraData: {
    readiness: OuraReadiness[];
    sleep: OuraSleep[];
    activity: OuraActivity[];
  } | null,
  whoopData: {
    recovery: WhoopRecovery[];
    cycles: WhoopCycle[];
    sleep: WhoopSleep[];
  } | null,
  startDate: string,
  endDate: string
): DailyHealthData[] {
  const ouraReadinessMap = ouraData
    ? groupByDate(ouraData.readiness, 'day')
    : new Map();
  const ouraSleepMap = ouraData
    ? groupByDate(ouraData.sleep, 'day')
    : new Map();
  const ouraActivityMap = ouraData
    ? groupByDate(ouraData.activity, 'day')
    : new Map();

  // Build recovery map by cycle_id first
  const recoveryByCycleId = whoopData
    ? new Map(whoopData.recovery.map((r) => [r.cycle_id, r]))
    : new Map();

  // Map cycles to their date (strain/kilojoule stays on cycle date)
  const whoopCycleMap = whoopData
    ? new Map(whoopData.cycles.map((c) => [c.start.split('T')[0], c]))
    : new Map();

  // Map recovery to NEXT day (wake-up date)
  const whoopRecoveryMap = new Map<string, WhoopRecovery>();
  if (whoopData) {
    for (const cycle of whoopData.cycles) {
      const recovery = recoveryByCycleId.get(cycle.id);
      if (recovery) {
        const cycleDate = new Date(cycle.start.split('T')[0]);
        cycleDate.setDate(cycleDate.getDate() + 1);
        const wakeUpDate = cycleDate.toISOString().split('T')[0];
        whoopRecoveryMap.set(wakeUpDate, recovery);
      }
    }
  }

  const whoopSleepMap = whoopData
    ? new Map(whoopData.sleep.map((s) => [s.start.split('T')[0], s]))
    : new Map();

  const dates = generateDateRange(startDate, endDate);

  return dates.map((date) =>
    aggregateDailyData(
      date,
      ouraReadinessMap.get(date),
      ouraSleepMap.get(date),
      ouraActivityMap.get(date),
      whoopRecoveryMap.get(date),
      whoopCycleMap.get(date),
      whoopSleepMap.get(date)
    )
  );
}

// Process all data from both APIs into weekly summaries
export function processHealthData(
  ouraData: {
    readiness: OuraReadiness[];
    sleep: OuraSleep[];
    activity: OuraActivity[];
  } | null,
  whoopData: {
    recovery: WhoopRecovery[];
    cycles: WhoopCycle[];
    sleep: WhoopSleep[];
  } | null,
  startDate: string,
  endDate: string
): WeeklyHealthData[] {
  // Group all data by date
  const ouraReadinessMap = ouraData
    ? groupByDate(ouraData.readiness, 'day')
    : new Map();
  const ouraSleepMap = ouraData
    ? groupByDate(ouraData.sleep, 'day')
    : new Map();
  const ouraActivityMap = ouraData
    ? groupByDate(ouraData.activity, 'day')
    : new Map();

  // Build recovery map by cycle_id first
  const recoveryByCycleId = whoopData
    ? new Map(whoopData.recovery.map((r) => [r.cycle_id, r]))
    : new Map();

  // Map cycles to their date (strain/kilojoule stays on cycle date)
  const whoopCycleMap = whoopData
    ? new Map(whoopData.cycles.map((c) => [c.start.split('T')[0], c]))
    : new Map();

  // Map recovery to NEXT day (wake-up date)
  // Recovery is measured when you wake up, which is the day after the cycle started
  const whoopRecoveryMap = new Map<string, WhoopRecovery>();
  if (whoopData) {
    for (const cycle of whoopData.cycles) {
      const recovery = recoveryByCycleId.get(cycle.id);
      if (recovery) {
        const cycleDate = new Date(cycle.start.split('T')[0]);
        cycleDate.setDate(cycleDate.getDate() + 1); // Next day
        const wakeUpDate = cycleDate.toISOString().split('T')[0];
        whoopRecoveryMap.set(wakeUpDate, recovery);
      }
    }
  }

  const whoopSleepMap = whoopData
    ? new Map(whoopData.sleep.map((s) => [s.start.split('T')[0], s]))
    : new Map();

  // Generate all dates in range
  const dates = generateDateRange(startDate, endDate);

  // Aggregate daily data
  const dailyData: DailyHealthData[] = dates.map((date) =>
    aggregateDailyData(
      date,
      ouraReadinessMap.get(date),
      ouraSleepMap.get(date),
      ouraActivityMap.get(date),
      whoopRecoveryMap.get(date),
      whoopCycleMap.get(date),
      whoopSleepMap.get(date)
    )
  );

  // Group into weeks (Sunday to Saturday)
  const weekMap = new Map<string, DailyHealthData[]>();

  for (const day of dailyData) {
    const date = new Date(day.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);

    // Handle year boundary (week 53/week 1)
    let key: string;
    if (week === 1 && date.getMonth() === 0 && date.getDate() <= 4) {
      key = `${year - 1}-W53`;
    } else if (week >= 52 && date.getMonth() === 11 && date.getDate() >= 29) {
      key = `${year}-W53`;
    } else {
      key = `${year}-W${week}`;
    }

    if (!weekMap.has(key)) {
      weekMap.set(key, []);
    }
    weekMap.get(key)!.push(day);
  }

  // Sort week keys descending (newest first)
  const sortedWeekKeys = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a));

  const result: WeeklyHealthData[] = [];

  for (const key of sortedWeekKeys) {
    const days = weekMap.get(key)!;
    days.sort((a, b) => a.date.localeCompare(b.date));

    const weeklyAggregate = aggregateWeeklyData(days);
    const isIncomplete = days.length < 7;

    if (isIncomplete) {
      // Add week summary row first
      result.push({
        ...weeklyAggregate,
        row_type: 'week_cumulative',
      });

      // Then add daily rows (newest first)
      const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));
      let cumulativeMetMin = 0;

      for (const day of sortedDays) {
        const dayDate = new Date(day.date);
        // Calculate cumulative from oldest to this day
        const daysUpToThis = days.filter(d => d.date <= day.date);
        const cumulativeKj = daysUpToThis.reduce(
          (acc, d) => acc + (d.whoop?.strain?.score?.kilojoule ?? 0),
          0
        );
        cumulativeMetMin = Math.round(cumulativeKj / 52);

        result.push({
          week: `  ${dayDate.getMonth() + 1}/${dayDate.getDate()}`,
          date_range: ['日', '一', '二', '三', '四', '五', '六'][dayDate.getDay()],
          start_date: day.date,
          end_date: day.date,
          daily_data: [],
          days_count: 1,
          avg_readiness: day.combined.readiness_score,
          avg_recovery: day.combined.recovery_score,
          avg_sleep: day.combined.sleep_score,
          avg_hrv: day.combined.hrv,
          avg_steps: day.combined.steps,
          total_strain: day.combined.strain,
          total_met_minutes: day.combined.met_minutes,
          cumulative_met_minutes: cumulativeMetMin,
          zone: '-',
          trend: '→',
          health_status: '健康',
          row_type: 'day',
        });
      }
    } else {
      // Complete week - single row
      result.push({
        ...weeklyAggregate,
        row_type: 'week',
      });
    }
  }

  // Compute trends between week rows
  const weekRows = result.filter(r => r.row_type === 'week' || r.row_type === 'week_cumulative');
  for (let i = 0; i < weekRows.length - 1; i++) {
    const curr = weekRows[i];
    const prev = weekRows[i + 1];
    curr.trend = determineTrend(curr.avg_recovery, prev.avg_recovery);
  }

  return result;
}
