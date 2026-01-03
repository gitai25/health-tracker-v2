"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import SummaryCards from "./SummaryCards";
import TableRow from "./TableRow";
import Legend from "./Legend";
import DataSources from "./DataSources";
import type { WeeklyHealthData } from "@/lib/types";

interface WeeklyTableProps {
  initialData?: WeeklyHealthData[];
}

export default function WeeklyTable({ initialData = [] }: WeeklyTableProps) {
  const [data, setData] = useState<WeeklyHealthData[]>(initialData);
  const [loading, setLoading] = useState(!initialData.length);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState({ oura: false, whoop: false, cached: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health?weeks=12");
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setSources(result.sources || { oura: false, whoop: false, cached: false });
      } else {
        setError(result.error || "Failed to fetch data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData.length) return;
    fetchData();
  }, [initialData]);

  const dateRange = useMemo(() => {
    if (data.length === 0) return "";
    const first = data[0].date_range;
    const last = data[data.length - 1].date_range;
    return `${first} - ${last}`;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-slate-200 rounded w-1/2 mx-auto" />
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-200 rounded" />
              ))}
            </div>
            <div className="h-96 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-6 text-center">
              <p className="text-red-600">Error: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-800">
            Health Tracker - Readiness & Recovery
          </h1>
          <p className="text-slate-500">
            Oura Readiness + Whoop Recovery | {dateRange || "No data"}
          </p>
        </div>

        <DataSources
          oura={sources.oura}
          whoop={sources.whoop}
          cached={sources.cached}
          onRefresh={fetchData}
        />

        <SummaryCards data={data} />

        <Card className="bg-white shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold">Week</th>
                    <th className="px-3 py-3 text-left font-semibold">Date</th>
                    <th className="px-3 py-3 text-center font-semibold">
                      <span className="text-amber-300">MET-min</span>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      <span className="text-purple-300">Readiness</span>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      <span className="text-green-300">Recovery</span>
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">HRV</th>
                    <th className="px-3 py-3 text-center font-semibold">Sleep</th>
                    <th className="px-3 py-3 text-center font-semibold">Steps</th>
                    <th className="px-3 py-3 text-center font-semibold">Zone</th>
                    <th className="px-3 py-3 text-center font-semibold">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <TableRow key={row.week + index} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Legend />
      </div>
    </div>
  );
}
