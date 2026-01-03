"use client";

import { Card, CardContent } from "@/components/ui/card";

const LEGEND_ITEMS = [
  { color: "bg-green-400", label: "Optimal Zone" },
  { color: "bg-emerald-500", label: "Golden Anchor" },
  { color: "bg-blue-400", label: "Recovery State" },
  { color: "bg-amber-400", label: "Elevated/High Load" },
  { color: "bg-red-500", label: "J-curve Risk" },
  { color: "bg-purple-500", label: "Sick" },
  { color: "bg-cyan-500", label: "Recovering" },
];

export default function Legend() {
  return (
    <Card className="bg-white/80 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${item.color}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-3">
          Readiness (Oura) | Recovery (Whoop) | Combined health metrics from both platforms
        </p>
      </CardContent>
    </Card>
  );
}
