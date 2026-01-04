// Centralized configuration constants

// MET-minutes calculation constants (for 72kg person)
export const MET_CONFIG = {
  // BMR = 72kg × 24hr × 1kcal/kg/hr = 1728 kcal = 7230 kJ
  BMR_KJ: 7230,
  // 1 MET-min ≈ 5 kJ for 72kg person
  CONVERSION_FACTOR: 5,
};

// Zone thresholds (daily values, derived from weekly ÷ 7)
export const ZONE_THRESHOLDS = {
  // MET-min thresholds
  MET: {
    J_RISK: 214,        // Weekly > 1500
    CRITICAL: 200,      // Weekly 1400-1500
    HIGH_LOAD: 186,     // Weekly 1300-1400
    SLIGHTLY_HIGH: 171, // Weekly 1200-1300
    OPTIMAL_MAX: 171,   // Weekly 1200
    OPTIMAL_MIN: 129,   // Weekly 900
    GOLDEN_MAX: 157,    // Weekly ~1100
    GOLDEN_MIN: 143,    // Weekly ~1000
  },
  // Strain thresholds
  STRAIN: {
    J_RISK: 18,
    CRITICAL: 16,
    HIGH_LOAD: 14,
    SLIGHTLY_HIGH: 12,
    OPTIMAL_MAX: 14,
    OPTIMAL_MIN: 6,
    GOLDEN_MAX: 12,
    GOLDEN_MIN: 8,
  },
  // Recovery thresholds
  RECOVERY: {
    GOOD: 67,
    LOW: 34,
  },
};

// Zone names (Chinese)
export const ZONE_NAMES = {
  J_RISK: 'J型右侧风险',
  CRITICAL: '右侧临界',
  HIGH_LOAD: '高负荷',
  SLIGHTLY_HIGH: '稍高',
  GOLDEN: '黄金锚点',
  OPTIMAL: '最优区',
  RECOVERY: '恢复稳态',
} as const;

// Token refresh configuration
export const TOKEN_CONFIG = {
  // Buffer time before expiry to trigger refresh (5 minutes)
  REFRESH_BUFFER_MS: 5 * 60 * 1000,
};

// API endpoints
export const API_ENDPOINTS = {
  WHOOP: {
    BASE: 'https://api.prod.whoop.com/developer/v2',
    TOKEN: 'https://api.prod.whoop.com/oauth/oauth2/token',
  },
  OURA: {
    BASE: 'https://api.ouraring.com/v2/usercollection',
    TOKEN: 'https://api.ouraring.com/oauth/token',
  },
};

// Data display configuration
export const DISPLAY_CONFIG = {
  DEFAULT_WEEKS: 12,
  DAYS_PER_WEEK: 7,
};
