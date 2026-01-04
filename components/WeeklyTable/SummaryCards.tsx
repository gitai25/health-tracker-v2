"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { WeeklyHealthData } from "@/lib/types";

interface SummaryCardsProps {
  data: WeeklyHealthData[];
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        avgMetMin: null,
        avgReadiness: null,
        avgRecovery: null,
        avgSleep: null,
        avgHrv: null,
        avgSteps: null,
      };
    }

    // Calculate average weekly MET-min (only count complete weeks with 7 days)
    const completeWeeks = data.filter(
      (d) => d.row_type === 'week' && d.daily_data.length === 7 && d.total_met_minutes !== null
    );
    const validMetMin = completeWeeks
      .map((d) => d.total_met_minutes!)
      .filter((v): v is number => v !== null);
    const validReadiness = data
      .map((d) => d.avg_readiness)
      .filter((v): v is number => v !== null);
    const validRecovery = data
      .map((d) => d.avg_recovery)
      .filter((v): v is number => v !== null);
    const validSleep = data
      .map((d) => d.avg_sleep)
      .filter((v): v is number => v !== null);
    const validHrv = data
      .map((d) => d.avg_hrv)
      .filter((v): v is number => v !== null);
    const validSteps = data
      .map((d) => d.avg_steps)
      .filter((v): v is number => v !== null);

    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return {
      avgMetMin: avg(validMetMin),
      avgReadiness: avg(validReadiness),
      avgRecovery: avg(validRecovery),
      avgSleep: avg(validSleep),
      avgHrv: avg(validHrv),
      avgSteps: avg(validSteps),
    };
  }, [data]);

  const cards = [
    {
      label: "Avg Weekly MET",
      value: stats.avgMetMin,
      suffix: "",
      hint: "Target: 900-1200/week",
      hintColor: "text-amber-600",
      source: "whoop",
    },
    {
      label: "Avg Readiness",
      value: stats.avgReadiness,
      suffix: "",
      hint: "Oura Score",
      hintColor: "text-purple-600",
      source: "oura",
    },
    {
      label: "Avg Recovery",
      value: stats.avgRecovery,
      suffix: "%",
      hint: "Whoop Score",
      hintColor: "text-green-600",
      source: "whoop",
    },
    {
      label: "Avg HRV",
      value: stats.avgHrv,
      suffix: " ms",
      hint: "Heart Rate Variability",
      hintColor: "text-blue-600",
      source: "both",
    },
    {
      label: "Avg Sleep",
      value: stats.avgSleep,
      suffix: "",
      hint: "Sleep Score",
      hintColor: "text-indigo-600",
      source: "both",
    },
    {
      label: "Avg Steps",
      value: stats.avgSteps?.toLocaleString(),
      suffix: "",
      hint: "Daily Average",
      hintColor: "text-teal-600",
      source: "oura",
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="bg-white shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="text-2xl font-bold text-slate-800">
              {card.value !== null ? `${card.value}${card.suffix}` : "-"}
            </p>
            <p className={`text-xs ${card.hintColor}`}>{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
