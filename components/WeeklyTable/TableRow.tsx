"use client";

import {
  getRowStyle,
  getZoneBadge,
  getTrendStyle,
  getReadinessStyle,
  getRecoveryStyle,
  getHrvStyle,
  getSleepStyle,
  getStrainStyle,
  getStepsStyle,
  getMetMinutesStyle,
} from "./styles";
import type { WeeklyHealthData } from "@/lib/types";

interface TableRowProps {
  row: WeeklyHealthData;
}

export default function TableRow({ row }: TableRowProps) {
  const rowType = row.row_type || 'week';
  const isDay = rowType === 'day';
  const isCumulative = rowType === 'week_cumulative';
  const daysCount = row.days_count || 7;

  // For daily rows, show daily MET + cumulative in parentheses
  // For week rows, show total
  const metDisplay = isDay
    ? row.total_met_minutes
    : row.total_met_minutes;
  const cumulativeDisplay = isDay ? (row.cumulative_met_minutes ?? null) : null;

  // Row styling based on type
  const rowClasses = isDay
    ? 'bg-slate-50/50 text-slate-600'
    : isCumulative
    ? 'bg-amber-50 font-medium'
    : getRowStyle(row.total_strain, row.zone, row.health_status);

  return (
    <tr className={`${rowClasses} transition-colors hover:opacity-80`}>
      <td className="px-3 py-2 font-medium text-slate-700 text-sm">
        <div className="flex items-center gap-2">
          <span className={isDay ? 'text-slate-500 text-xs' : ''}>
            {row.week}
          </span>
          {isCumulative && (
            <span className="px-1.5 py-0.5 text-xs bg-amber-200 text-amber-800 rounded font-semibold">
              {daysCount}天累计
            </span>
          )}
        </div>
      </td>
      <td className={`px-3 py-2 text-sm ${isDay ? 'text-slate-500' : 'text-slate-600'}`}>
        {row.date_range}
      </td>
      <td className="px-3 py-2 text-center">
        {isDay ? (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-slate-500">
              +{metDisplay ?? 0}
            </span>
            <span className={`font-mono font-bold text-sm ${getMetMinutesStyle(cumulativeDisplay)}`}>
              {cumulativeDisplay ?? "-"}
            </span>
          </div>
        ) : (
          <span className={`font-mono font-bold text-sm ${getMetMinutesStyle(metDisplay)}`}>
            {metDisplay ?? "-"}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`font-mono ${isDay ? 'text-sm' : 'font-bold text-sm'} ${getReadinessStyle(row.avg_readiness)}`}
        >
          {row.avg_readiness ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`font-mono ${isDay ? 'text-sm' : 'font-bold text-sm'} ${getRecoveryStyle(row.avg_recovery)}`}
        >
          {row.avg_recovery !== null ? `${row.avg_recovery}%` : "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getHrvStyle(row.avg_hrv ?? null)}`}>
          {row.avg_hrv ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getSleepStyle(row.avg_sleep)}`}>
          {row.avg_sleep ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getStepsStyle(row.avg_steps)}`}>
          {row.avg_steps?.toLocaleString() ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        {!isDay ? (
          <span
            className={`px-2 py-1 rounded-full text-xs font-semibold ${getZoneBadge(row.zone)}`}
          >
            {row.zone}
          </span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {!isDay ? (
          <span className={getTrendStyle(row.trend)}>{row.trend}</span>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}
