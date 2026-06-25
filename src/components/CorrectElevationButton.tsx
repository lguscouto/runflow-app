"use client";

import { useState } from "react";
import { Mountain, Loader2 } from "lucide-react";
import { enrichActivityElevationWithRetry } from "@/lib/enrichment";
import { useI18n } from "@/lib/i18n";

export function CorrectElevationButton({ activityId }: { activityId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCorrect() {
    setLoading(true);
    setError(null);
    try {
      await enrichActivityElevationWithRetry(activityId, (current, total) => {
        setProgress({ current, total });
      });
      // Recarregar a página para exibir as novas métricas e gráficos recalculados
      window.location.reload();
    } catch (e) {
      console.error(e);
      setError(t("common.error"));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-ghost"
        onClick={handleCorrect}
        disabled={loading}
        title={t("detail.correct_elevation_btn")}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Mountain size={16} />
        )}
        {loading && progress
          ? `${Math.round((progress.current / progress.total) * 100)}%`
          : loading
          ? t("detail.correct_elevation_loading")
          : t("detail.correct_elevation_btn")}
      </button>
      {error && <p className="text-xs text-red-400 max-w-[200px] text-right">{error}</p>}
    </div>
  );
}
