export function getRowStyle(strain: number | null, zone: string, healthStatus: string): string {
  if (healthStatus === "生病") return "bg-purple-100 border-l-4 border-purple-500";
  if (healthStatus === "恢复中") return "bg-cyan-50 border-l-4 border-cyan-400";
  if (healthStatus === "献血恢复期") return "bg-rose-50 border-l-4 border-rose-400";
  if (healthStatus === "生酮饮食") return "bg-orange-50 border-l-4 border-orange-400";
  if ((strain && strain > 100) || zone === "J型右侧风险") return "bg-red-100 border-l-4 border-red-500";
  if ((strain && strain > 80) || zone.includes("高负荷") || zone === "右侧临界")
    return "bg-amber-50 border-l-4 border-amber-400";
  if (zone === "黄金锚点") return "bg-emerald-100 border-l-4 border-emerald-500";
  if (zone === "恢复稳态") return "bg-blue-50 border-l-4 border-blue-400";
  return "bg-green-50 border-l-4 border-green-400";
}

const ZONE_BADGE_MAP: Record<string, string> = {
  最优区: "bg-green-500 text-white",
  稍高: "bg-amber-400 text-white",
  "J型右侧风险": "bg-red-500 text-white",
  恢复稳态: "bg-blue-500 text-white",
  黄金锚点: "bg-emerald-600 text-white",
  轻度高负荷: "bg-amber-500 text-white",
  高负荷: "bg-orange-500 text-white",
  右侧临界: "bg-red-400 text-white",
};

export function getZoneBadge(zone: string): string {
  return ZONE_BADGE_MAP[zone] || "bg-gray-400 text-white";
}

const HEALTH_BADGE_MAP: Record<string, string> = {
  健康: "bg-green-600 text-white",
  生病: "bg-purple-600 text-white",
  恢复中: "bg-cyan-600 text-white",
  献血恢复期: "bg-rose-600 text-white",
  生酮饮食: "bg-orange-600 text-white",
};

export function getHealthBadge(status: string): string {
  return HEALTH_BADGE_MAP[status] || "bg-gray-400 text-white";
}

export function getTrendStyle(trend: string): string {
  if (trend === "↑") return "text-green-600 font-bold text-lg";
  if (trend === "↓") return "text-red-600 font-bold text-lg";
  return "text-gray-500 text-lg";
}

export function getReadinessStyle(readiness: number | null): string {
  if (readiness === null) return "text-gray-400";
  if (readiness >= 85) return "text-green-600 font-bold";
  if (readiness >= 70) return "text-green-500";
  if (readiness >= 50) return "text-amber-600";
  return "text-red-600 font-bold";
}

export function getRecoveryStyle(recovery: number | null): string {
  if (recovery === null) return "text-gray-400";
  if (recovery >= 67) return "text-green-600 font-bold";
  if (recovery >= 34) return "text-amber-600";
  return "text-red-600 font-bold";
}

export function getHrvStyle(hrv: number | null): string {
  if (hrv === null) return "text-gray-400";
  if (hrv < 30) return "text-red-600 font-bold";
  if (hrv < 50) return "text-amber-600";
  return "text-slate-600";
}

export function getSleepStyle(sleep: number | null): string {
  if (sleep === null) return "text-gray-400";
  if (sleep >= 85) return "text-green-600 font-bold";
  if (sleep >= 70) return "text-green-500";
  if (sleep < 60) return "text-amber-600";
  return "text-slate-600";
}

export function getStrainStyle(strain: number | null): string {
  if (strain === null) return "text-gray-400";
  if (strain > 100) return "text-red-600 font-bold";
  if (strain > 80) return "text-amber-600";
  return "text-slate-600";
}

export function getStepsStyle(steps: number | null): string {
  if (steps === null) return "text-gray-400";
  if (steps > 10000) return "text-green-600 font-bold";
  if (steps < 5000) return "text-amber-600";
  return "text-slate-600";
}

export function getMetMinutesStyle(metMin: number | null): string {
  if (metMin === null) return "text-gray-400";
  if (metMin > 1400) return "text-red-600 font-bold";
  if (metMin > 1200) return "text-amber-600 font-bold";
  if (metMin >= 900 && metMin <= 1200) return "text-green-600 font-bold";
  if (metMin < 900) return "text-blue-600";
  return "text-slate-600";
}
