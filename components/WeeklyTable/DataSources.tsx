"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface DataSourcesProps {
  oura: boolean;
  whoop: boolean;
  cached?: boolean;
  onRefresh?: () => void;
}

export default function DataSources({ oura, whoop, cached, onRefresh }: DataSourcesProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const adminToken = process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  const connected = oura || whoop;

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus(null);

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (adminToken) headers["x-admin-token"] = adminToken;
      const response = await fetch("/api/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ weeks: 12 }),
      });

      const result = await response.json();

      if (result.success) {
        const total = result.synced?.total ?? 0;
        setSyncStatus(`Synced ${total} days`);
        onRefresh?.();
      } else {
        setSyncStatus(`Error: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSyncStatus(`Error: ${error instanceof Error ? error.message : "Sync failed"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className={connected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
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

            {cached && (
              <>
                <div className="w-px h-6 bg-gray-300" />
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  From cache
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {syncStatus && (
              <span className={`text-xs ${syncStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                {syncStatus}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing || !connected}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                syncing || !connected
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {syncing ? "Syncing..." : "Sync to DB"}
            </button>
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
