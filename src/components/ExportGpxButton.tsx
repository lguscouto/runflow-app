"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { ActivityDetail } from "@/lib/types";
import { buildGpxXml, gpxFilename } from "@/lib/export-gpx";
import { shareOrDownloadFile } from "@/lib/share-file";

export function ExportGpxButton({ activity }: { activity: ActivityDetail }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canExport = activity.points.length >= 2;

  async function handleExport() {
    if (!canExport) return;
    setLoading(true);
    setError(null);
    try {
      const gpx = buildGpxXml(activity);
      const filename = gpxFilename(activity);
      await shareOrDownloadFile(gpx, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao exportar GPX");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-ghost"
        onClick={handleExport}
        disabled={loading || !canExport}
        title={
          canExport
            ? "Exportar ou compartilhar GPX"
            : "Sem pontos GPS suficientes"
        }
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {loading ? "Exportando..." : "Exportar GPX"}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-right">{error}</p>}
    </div>
  );
}
