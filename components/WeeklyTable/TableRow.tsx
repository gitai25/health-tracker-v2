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
} from "./styles";
import type { WeeklyHealthData } from "@/lib/types";

interface TableRowProps {
  row: WeeklyHealthData;
}

export default function TableRow({ row }: TableRowProps) {
  return (
    <tr
      className={`${getRowStyle(row.total_strain, row.zone, row.health_status)} transition-colors hover:opacity-80`}
    >
      <td className="px-3 py-2 font-medium text-slate-700 text-sm">
        {row.week}
      </td>
      <td className="px-3 py-2 text-slate-600 text-sm">{row.date_range}</td>
      <td className="px-3 py-2 text-center">
        <span
          className={`font-mono font-bold text-sm ${getReadinessStyle(row.avg_readiness)}`}
        >
          {row.avg_readiness ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`font-mono font-bold text-sm ${getRecoveryStyle(row.avg_recovery)}`}
        >
          {row.avg_recovery !== null ? `${row.avg_recovery}%` : "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getHrvStyle(row.avg_hrv)}`}>
          {row.avg_hrv ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getSleepStyle(row.avg_sleep)}`}>
          {row.avg_sleep ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`font-mono text-sm ${getStrainStyle(row.total_strain)}`}
        >
          {row.total_strain !== null
            ? Math.round(row.total_strain * 10) / 10
            : "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-sm ${getStepsStyle(row.avg_steps)}`}>
          {row.avg_steps?.toLocaleString() ?? "-"}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${getZoneBadge(row.zone)}`}
        >
          {row.zone}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={getTrendStyle(row.trend)}>{row.trend}</span>
      </td>
    </tr>
  );
}
