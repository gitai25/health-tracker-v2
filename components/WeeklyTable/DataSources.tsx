"use client";

import { Card, CardContent } from "@/components/ui/card";

interface DataSourcesProps {
  oura: boolean;
  whoop: boolean;
}

export default function DataSources({ oura, whoop }: DataSourcesProps) {
  const connected = oura || whoop;

  return (
    <Card className={connected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${oura ? "bg-green-500" : "bg-gray-300"}`}
            />
            <span className={oura ? "text-green-700 font-medium" : "text-gray-500"}>
              Oura Ring
            </span>
            {!oura && (
              <a
                href="/api/auth/oura"
                className="text-xs text-blue-600 hover:underline ml-2"
              >
                Connect
              </a>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300" />

          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${whoop ? "bg-green-500" : "bg-gray-300"}`}
            />
            <span className={whoop ? "text-green-700 font-medium" : "text-gray-500"}>
              Whoop
            </span>
            {!whoop && (
              <a
                href="/api/auth/whoop"
                className="text-xs text-blue-600 hover:underline ml-2"
              >
                Connect
              </a>
            )}
          </div>
        </div>

        {!connected && (
          <p className="text-center text-xs text-amber-600 mt-2">
            Using demo data. Connect at least one device to see your real health data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
