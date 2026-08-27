"use client";

import { useState, useRef } from "react";
import { Heart, Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { mergeFitHeartRateIntoActivity } from "@/lib/enrichment";
import { useI18n } from "@/lib/i18n";

export function MergeFitButton({ activityId }: { activityId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".fit")) {
      setResult({
        success: false,
        message: t("detail.merge_fit_invalid_format"),
      });
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const mergeResult = await mergeFitHeartRateIntoActivity(activityId, file);

      if (mergeResult.hasHrData) {
        setResult({
          success: true,
          message: t("detail.merge_fit_success", {
            count: mergeResult.hrPointsAdded,
          }),
        });
      } else {
        setResult({
          success: true,
          message: t("detail.merge_fit_no_hr"),
        });
      }

      // Recarregar após 2s para exibir novos dados
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Erro ao mesclar FIT:", err);
      setResult({
        success: false,
        message:
          err instanceof Error ? err.message : t("common.error"),
      });
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".fit"
        className="hidden"
        onChange={handleFileSelected}
      />

      <button
        type="button"
        className="btn-ghost"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        title={t("detail.merge_fit_btn")}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Heart size={16} className="text-[var(--color-status-danger)]" />
        )}
        {loading
          ? t("detail.merge_fit_loading")
          : t("detail.merge_fit_btn")}
      </button>

      {result && (
        <div
          className={`flex items-center gap-1 text-xs max-w-[220px] text-right ${
            result.success ? "text-[var(--color-status-positive)]" : "text-[var(--color-status-danger)]"
          }`}
        >
          {result.success ? (
            <CheckCircle size={12} />
          ) : (
            <AlertCircle size={12} />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
