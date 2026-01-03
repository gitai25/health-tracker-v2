// Oura API Types
export interface OuraReadiness {
  id: string;
  day: string;
  score: number;
  temperature_deviation: number | null;
  temperature_trend_deviation: number | null;
  timestamp: string;
  contributors: {
    activity_balance: number | null;
    body_temperature: number | null;
    hrv_balance: number | null;
    previous_day_activity: number | null;
    previous_night: number | null;
    recovery_index: number | null;
    resting_heart_rate: number | null;
    sleep_balance: number | null;
  };
}

export interface OuraSleep {
  id: string;
  day: string;
  score: number | null;
  timestamp: string;
  contributors: {
    deep_sleep: number | null;
    efficiency: number | null;
    latency: number | null;
    rem_sleep: number | null;
    restfulness: number | null;
    timing: number | null;
    total_sleep: number | null;
  };
}

export interface OuraActivity {
  id: string;
  day: string;
  score: number | null;
  active_calories: number;
  steps: number;
  equivalent_walking_distance: number;
  high_activity_met_minutes: number; // MET-minutes for high activity
  medium_activity_met_minutes: number; // MET-minutes for medium activity
  low_activity_met_minutes: number; // MET-minutes for low activity
  met: {
    interval: number;
    items: number[];
    timestamp: string;
  };
  contributors: {
    meet_daily_targets: number | null;
    move_every_hour: number | null;
    recovery_time: number | null;
    stay_active: number | null;
    training_frequency: number | null;
    training_volume: number | null;
  };
}

// Whoop API Types
export interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number | null;
    skin_temp_celsius: number | null;
  } | null;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  } | null;
}

export interface WhoopSleep {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  } | null;
}

// Combined Health Data
export interface DailyHealthData {
  date: string;

  // Oura Data
  oura?: {
    readiness: OuraReadiness | null;
    sleep: OuraSleep | null;
    activity: OuraActivity | null;
  };

  // Whoop Data
  whoop?: {
    recovery: WhoopRecovery | null;
    strain: WhoopCycle | null;
    sleep: WhoopSleep | null;
  };

  // Computed/Combined Metrics
  combined: {
    readiness_score: number | null;
    recovery_score: number | null;
    sleep_score: number | null;
    hrv: number | null;
    rhr: number | null;
    strain: number | null;
    steps: number | null;
    met_minutes: number | null; // Total MET-minutes
    zone: string;
    trend: string;
    health_status: string;
  };
}

export interface WeeklyHealthData {
  week: string;
  date_range: string;
  start_date: string;
  end_date: string;
  daily_data: DailyHealthData[];

  // Weekly Averages
  avg_readiness: number | null;
  avg_recovery: number | null;
  avg_sleep: number | null;
  avg_hrv: number | null;
  avg_steps: number | null;
  total_strain: number | null;
  total_met_minutes: number | null; // Weekly total MET-minutes

  // Status
  zone: string;
  trend: string;
  health_status: string;
}

// API Response Types
export interface OuraApiResponse<T> {
  data: T[];
  next_token: string | null;
}

export interface WhoopApiResponse<T> {
  records: T[];
  next_token: string | null;
}

// Toast for UI
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Settings
export interface ApiSettings {
  oura_connected: boolean;
  whoop_connected: boolean;
  oura_token?: string;
  whoop_token?: string;
}
