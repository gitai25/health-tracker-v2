-- Cloudflare D1 Schema for Health Tracker

-- Daily health records from Oura and Whoop
CREATE TABLE IF NOT EXISTS daily_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,

  -- Oura Readiness
  oura_readiness_score INTEGER,
  oura_readiness_hrv_balance INTEGER,
  oura_readiness_body_temp INTEGER,
  oura_readiness_recovery_index INTEGER,

  -- Oura Sleep
  oura_sleep_score INTEGER,
  oura_sleep_deep INTEGER,
  oura_sleep_rem INTEGER,
  oura_sleep_efficiency INTEGER,

  -- Oura Activity
  oura_steps INTEGER,
  oura_active_calories INTEGER,
  oura_activity_score INTEGER,

  -- Whoop Recovery
  whoop_recovery_score INTEGER,
  whoop_hrv REAL,
  whoop_rhr INTEGER,
  whoop_spo2 REAL,
  whoop_skin_temp REAL,

  -- Whoop Strain
  whoop_strain REAL,
  whoop_calories INTEGER,
  whoop_avg_hr INTEGER,
  whoop_max_hr INTEGER,

  -- Whoop Sleep
  whoop_sleep_performance INTEGER,
  whoop_sleep_efficiency INTEGER,
  whoop_sleep_consistency INTEGER,

  -- Computed/Combined
  combined_hrv REAL,
  combined_rhr INTEGER,
  combined_sleep_score INTEGER,
  combined_recovery_score INTEGER,
  zone TEXT DEFAULT '最优区',
  trend TEXT DEFAULT '→',
  health_status TEXT DEFAULT '健康',
  notes TEXT,

  -- Metadata
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Weekly aggregates (cached for performance)
CREATE TABLE IF NOT EXISTS weekly_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,

  -- Averages
  avg_readiness INTEGER,
  avg_recovery INTEGER,
  avg_sleep INTEGER,
  avg_hrv REAL,
  avg_rhr INTEGER,
  avg_steps INTEGER,
  total_strain REAL,

  -- Status
  zone TEXT DEFAULT '最优区',
  trend TEXT DEFAULT '→',
  health_status TEXT DEFAULT '健康',

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(week_number, year)
);

-- Sync history
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, -- 'oura' or 'whoop'
  sync_type TEXT NOT NULL, -- 'full' or 'incremental'
  start_date TEXT,
  end_date TEXT,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_records(date);
CREATE INDEX IF NOT EXISTS idx_weekly_year_week ON weekly_records(year, week_number);
CREATE INDEX IF NOT EXISTS idx_sync_source ON sync_log(source, started_at);
