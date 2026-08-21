"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Flame, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PersonalHeatmap = dynamic(
  () => import("@/components/PersonalHeatmap").then((m) => m.PersonalHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[620px] w-full rounded-2xl bg-[#0d1117] border border-[var(--border)] animate-pulse flex flex-col items-center justify-center gap-3 text-[var(--muted)] text-sm">
        <Flame size={32} className="text-orange-500 animate-bounce" />
        <span>Carregando mapa de calor...</span>
      </div>
    ),
  }
);

export function HeatmapPageClient() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/atividades/"
              className="text-xs text-[var(--muted)] hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} />
              {t("common.back")}
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <Flame size={22} />
            </span>
            {t("heatmap.title")}
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {t("heatmap.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <Sparkles size={13} />
            100% Local & Privado
          </span>
        </div>
      </div>

      {/* Main Heatmap Container */}
      <PersonalHeatmap fullHeight={true} />
    </div>
  );
}
