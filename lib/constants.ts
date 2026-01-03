export const HEALTH_STATUS_OPTIONS = [
  '健康',
  '生病',
  '恢复中',
  '献血恢复期',
  '生酮饮食',
] as const;

export const TREND_OPTIONS = ['↑', '→', '↓'] as const;

export const ZONE_OPTIONS = [
  '最优区',
  '黄金锚点',
  '稍高',
  '高负荷',
  '恢复稳态',
  '右侧临界',
  'J型右侧风险',
  '轻度高负荷',
] as const;

// Zone badge colors
export const ZONE_COLORS: Record<string, string> = {
  最优区: 'bg-green-500 text-white',
  黄金锚点: 'bg-emerald-600 text-white',
  恢复稳态: 'bg-blue-500 text-white',
  稍高: 'bg-amber-400 text-black',
  高负荷: 'bg-orange-500 text-white',
  右侧临界: 'bg-red-400 text-white',
  'J型右侧风险': 'bg-red-600 text-white',
  轻度高负荷: 'bg-amber-500 text-white',
};

// Health status badge colors
export const HEALTH_STATUS_COLORS: Record<string, string> = {
  健康: 'bg-green-600 text-white',
  生病: 'bg-purple-600 text-white',
  恢复中: 'bg-cyan-600 text-white',
  献血恢复期: 'bg-rose-600 text-white',
  生酮饮食: 'bg-orange-600 text-white',
};

// Row background colors based on zone
export const ZONE_ROW_COLORS: Record<string, string> = {
  最优区: 'bg-green-50',
  黄金锚点: 'bg-emerald-100',
  恢复稳态: 'bg-blue-50',
  稍高: 'bg-amber-50',
  高负荷: 'bg-orange-50',
  右侧临界: 'bg-red-50',
  'J型右侧风险': 'bg-red-100',
  轻度高负荷: 'bg-amber-50',
};

// Row background colors based on health status
export const HEALTH_STATUS_ROW_COLORS: Record<string, string> = {
  生病: 'bg-purple-100',
  恢复中: 'bg-cyan-50',
  献血恢复期: 'bg-rose-50',
  生酮饮食: 'bg-orange-50',
};

// Metric thresholds for color coding
export const METRIC_THRESHOLDS = {
  readiness: { good: 70, warning: 50 },
  recovery: { good: 67, warning: 34 },
  sleep: { good: 80, warning: 60 },
  hrv: { good: 50, warning: 30 },
  strain: { high: 14, moderate: 10 },
};
