import type { DailyHealthData, WeeklyHealthData } from './types';

// D1 Database interface (from Cloudflare Workers types)
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// Daily record from database
export interface DailyRecord {
  id: number;
  date: string;

  // Oura
  oura_readiness_score: number | null;
  oura_readiness_hrv_balance: number | null;
  oura_readiness_body_temp: number | null;
  oura_readiness_recovery_index: number | null;
  oura_sleep_score: number | null;
  oura_sleep_deep: number | null;
  oura_sleep_rem: number | null;
  oura_sleep_efficiency: number | null;
  oura_steps: number | null;
  oura_active_calories: number | null;
  oura_activity_score: number | null;

  // Whoop
  whoop_recovery_score: number | null;
  whoop_hrv: number | null;
  whoop_rhr: number | null;
  whoop_spo2: number | null;
  whoop_skin_temp: number | null;
  whoop_strain: number | null;
  whoop_calories: number | null;
  whoop_avg_hr: number | null;
  whoop_max_hr: number | null;
  whoop_sleep_performance: number | null;
  whoop_sleep_efficiency: number | null;
  whoop_sleep_consistency: number | null;

  // Combined
  combined_hrv: number | null;
  combined_rhr: number | null;
  combined_sleep_score: number | null;
  combined_recovery_score: number | null;
  zone: string;
  trend: string;
  health_status: string;
  notes: string | null;

  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyRecord {
  id: number;
  week_number: number;
  year: number;
  start_date: string;
  end_date: string;
  avg_readiness: number | null;
  avg_recovery: number | null;
  avg_sleep: number | null;
  avg_hrv: number | null;
  avg_rhr: number | null;
  avg_steps: number | null;
  total_strain: number | null;
  zone: string;
  trend: string;
  health_status: string;
  created_at: string;
  updated_at: string;
}

export class D1Client {
  constructor(private db: D1Database) {}

  // Save daily record (upsert)
  async saveDailyRecord(data: DailyHealthData): Promise<void> {
    const oura = data.oura;
    const whoop = data.whoop;
    const combined = data.combined;

    await this.db
      .prepare(
        `INSERT INTO daily_records (
          date,
          oura_readiness_score, oura_readiness_hrv_balance, oura_readiness_body_temp, oura_readiness_recovery_index,
          oura_sleep_score, oura_sleep_deep, oura_sleep_rem, oura_sleep_efficiency,
          oura_steps, oura_active_calories, oura_activity_score,
          whoop_recovery_score, whoop_hrv, whoop_rhr, whoop_spo2, whoop_skin_temp,
          whoop_strain, whoop_calories, whoop_avg_hr, whoop_max_hr,
          whoop_sleep_performance, whoop_sleep_efficiency, whoop_sleep_consistency,
          combined_hrv, combined_rhr, combined_sleep_score, combined_recovery_score,
          zone, trend, health_status, synced_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(date) DO UPDATE SET
          oura_readiness_score = excluded.oura_readiness_score,
          oura_readiness_hrv_balance = excluded.oura_readiness_hrv_balance,
          oura_readiness_body_temp = excluded.oura_readiness_body_temp,
          oura_readiness_recovery_index = excluded.oura_readiness_recovery_index,
          oura_sleep_score = excluded.oura_sleep_score,
          oura_sleep_deep = excluded.oura_sleep_deep,
          oura_sleep_rem = excluded.oura_sleep_rem,
          oura_sleep_efficiency = excluded.oura_sleep_efficiency,
          oura_steps = excluded.oura_steps,
          oura_active_calories = excluded.oura_active_calories,
          oura_activity_score = excluded.oura_activity_score,
          whoop_recovery_score = excluded.whoop_recovery_score,
          whoop_hrv = excluded.whoop_hrv,
          whoop_rhr = excluded.whoop_rhr,
          whoop_spo2 = excluded.whoop_spo2,
          whoop_skin_temp = excluded.whoop_skin_temp,
          whoop_strain = excluded.whoop_strain,
          whoop_calories = excluded.whoop_calories,
          whoop_avg_hr = excluded.whoop_avg_hr,
          whoop_max_hr = excluded.whoop_max_hr,
          whoop_sleep_performance = excluded.whoop_sleep_performance,
          whoop_sleep_efficiency = excluded.whoop_sleep_efficiency,
          whoop_sleep_consistency = excluded.whoop_sleep_consistency,
          combined_hrv = excluded.combined_hrv,
          combined_rhr = excluded.combined_rhr,
          combined_sleep_score = excluded.combined_sleep_score,
          combined_recovery_score = excluded.combined_recovery_score,
          zone = excluded.zone,
          trend = excluded.trend,
          health_status = excluded.health_status,
          synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        data.date,
        oura?.readiness?.score ?? null,
        oura?.readiness?.contributors.hrv_balance ?? null,
        oura?.readiness?.contributors.body_temperature ?? null,
        oura?.readiness?.contributors.recovery_index ?? null,
        oura?.sleep?.score ?? null,
        oura?.sleep?.contributors.deep_sleep ?? null,
        oura?.sleep?.contributors.rem_sleep ?? null,
        oura?.sleep?.contributors.efficiency ?? null,
        oura?.activity?.steps ?? null,
        oura?.activity?.active_calories ?? null,
        oura?.activity?.score ?? null,
        whoop?.recovery?.score?.recovery_score ?? null,
        whoop?.recovery?.score?.hrv_rmssd_milli ?? null,
        whoop?.recovery?.score?.resting_heart_rate ?? null,
        whoop?.recovery?.score?.spo2_percentage ?? null,
        whoop?.recovery?.score?.skin_temp_celsius ?? null,
        whoop?.strain?.score?.strain ?? null,
        whoop?.strain?.score?.kilojoule ?? null,
        whoop?.strain?.score?.average_heart_rate ?? null,
        whoop?.strain?.score?.max_heart_rate ?? null,
        whoop?.sleep?.score?.sleep_performance_percentage ?? null,
        whoop?.sleep?.score?.sleep_efficiency_percentage ?? null,
        whoop?.sleep?.score?.sleep_consistency_percentage ?? null,
        combined.hrv,
        combined.rhr,
        combined.sleep_score,
        combined.recovery_score,
        combined.zone,
        combined.trend,
        combined.health_status
      )
      .run();
  }

  // Save multiple daily records
  async saveDailyRecords(records: DailyHealthData[]): Promise<number> {
    let saved = 0;
    for (const record of records) {
      await this.saveDailyRecord(record);
      saved++;
    }
    return saved;
  }

  // Get daily records by date range
  async getDailyRecords(startDate: string, endDate: string): Promise<DailyRecord[]> {
    const result = await this.db
      .prepare('SELECT * FROM daily_records WHERE date >= ? AND date <= ? ORDER BY date DESC')
      .bind(startDate, endDate)
      .all<DailyRecord>();

    return result.results || [];
  }

  // Save weekly record (upsert)
  async saveWeeklyRecord(data: WeeklyHealthData): Promise<void> {
    const startDateObj = new Date(data.start_date);
    const weekNumber = getWeekNumber(startDateObj);
    const year = startDateObj.getFullYear();

    await this.db
      .prepare(
        `INSERT INTO weekly_records (
          week_number, year, start_date, end_date,
          avg_readiness, avg_recovery, avg_sleep, avg_hrv, avg_rhr, avg_steps, total_strain,
          zone, trend, health_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(week_number, year) DO UPDATE SET
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          avg_readiness = excluded.avg_readiness,
          avg_recovery = excluded.avg_recovery,
          avg_sleep = excluded.avg_sleep,
          avg_hrv = excluded.avg_hrv,
          avg_rhr = excluded.avg_rhr,
          avg_steps = excluded.avg_steps,
          total_strain = excluded.total_strain,
          zone = excluded.zone,
          trend = excluded.trend,
          health_status = excluded.health_status,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        weekNumber,
        year,
        data.start_date,
        data.end_date,
        data.avg_readiness,
        data.avg_recovery,
        data.avg_sleep,
        data.avg_hrv,
        null, // avg_rhr not in WeeklyHealthData
        data.avg_steps,
        data.total_strain,
        data.zone,
        data.trend,
        data.health_status
      )
      .run();
  }

  // Get weekly records
  async getWeeklyRecords(weeks: number = 12): Promise<WeeklyRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM weekly_records
         ORDER BY year DESC, week_number DESC
         LIMIT ?`
      )
      .bind(weeks)
      .all<WeeklyRecord>();

    return result.results || [];
  }

  // Log sync
  async logSync(
    source: 'oura' | 'whoop',
    syncType: 'full' | 'incremental',
    startDate: string,
    endDate: string
  ): Promise<number> {
    const result = await this.db
      .prepare(
        `INSERT INTO sync_log (source, sync_type, start_date, end_date, status)
         VALUES (?, ?, ?, ?, 'pending')`
      )
      .bind(source, syncType, startDate, endDate)
      .run();

    return result.meta.last_row_id;
  }

  // Update sync log
  async updateSyncLog(
    id: number,
    status: 'success' | 'failed',
    recordsSynced: number,
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE sync_log SET
         status = ?, records_synced = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(status, recordsSynced, errorMessage || null, id)
      .run();
  }

  // Get last sync time
  async getLastSyncTime(source: 'oura' | 'whoop'): Promise<string | null> {
    const result = await this.db
      .prepare(
        `SELECT end_date FROM sync_log
         WHERE source = ? AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1`
      )
      .bind(source)
      .first<{ end_date: string }>();

    return result?.end_date || null;
  }
}

// Helper function
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// Convert DB record to WeeklyHealthData for frontend
export function dbRecordToWeeklyData(record: WeeklyRecord): WeeklyHealthData {
  return {
    week: `Week ${record.week_number}`,
    date_range: formatDateRange(record.start_date, record.end_date),
    start_date: record.start_date,
    end_date: record.end_date,
    daily_data: [],
    avg_readiness: record.avg_readiness,
    avg_recovery: record.avg_recovery,
    avg_sleep: record.avg_sleep,
    avg_hrv: record.avg_hrv,
    avg_steps: record.avg_steps,
    total_strain: record.total_strain,
    total_met_minutes: null, // TODO: Add to DB schema
    zone: record.zone,
    trend: record.trend,
    health_status: record.health_status,
  };
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const format = (d: Date) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  return `${format(s)} - ${format(e)}`;
}
