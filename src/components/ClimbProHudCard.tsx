"use client";

import type { ClimbProgressState } from "@/lib/types";
import { getCategoryBadgeStyle } from "@/lib/climb-detection";
import { formatDistance, formatElevation, formatGrade, formatDuration } from "@/lib/format";
import { Mountain, Flag, TrendingUp, Zap, Clock, AlertTriangle } from "lucide-react";
import { getGradeColorVar } from "@/lib/color-tokens";
import { useI18n } from "@/lib/i18n";

interface ClimbProHudCardProps {
  climbProgress: ClimbProgressState;
  currentSpeedKmh?: number | null;
  currentVamMh?: number | null;
  compact?: boolean;
  className?: string;
}

export function ClimbProHudCard({
  climbProgress,
  currentSpeedKmh = null,
  currentVamMh = null,
  compact = false,
  className = "",
}: ClimbProHudCardProps) {
  const { t } = useI18n();

  const {
    isActiveClimb,
    currentClimb,
    currentClimbNumber,
    totalClimbsCount,
    climbProgressPct,
    distanceRemainingM,
    elevationRemainingM,
    currentGradePct,
    avgGradeRemainingPct,
    nextClimb,
    distanceToNextClimbM,
    isApproachingClimb,
  } = climbProgress;

  // 1. Alerta de Aproximação de Subida (< 200m antes do início)
  if (isApproachingClimb && nextClimb) {
    const badgeStyle = getCategoryBadgeStyle(nextClimb.category);

    return (
      <div
        className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 shadow-lg shadow-amber-500/5 animate-pulse ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[var(--color-status-warning)]">
              <Mountain size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: badgeStyle.badgeBg, color: badgeStyle.badgeText }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider"
                >
                  {badgeStyle.label}
                </span>
                <p className="text-xs font-bold text-[var(--color-status-warning)]">
                  {t("climb.approach_title")} ({distanceToNextClimbM}m)
                </p>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                {t("climb.climb_n_of_total", {
                  current: nextClimb.climbIndex,
                  total: totalClimbsCount,
                })}{" "}
                • {formatDistance(nextClimb.distanceM)} @ {nextClimb.avgGradePct.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-black text-[var(--color-status-warning)] font-mono">
              +{Math.round(nextClimb.elevationGainM)}m
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Subida Ativa em Andamento (ClimbPro HUD Completo)
  if (isActiveClimb && currentClimb) {
    const badgeStyle = getCategoryBadgeStyle(currentClimb.category);
    const gradeColor = getGradeColorVar(currentGradePct);

    // Estimativa de tempo para o topo
    let etaSec: number | null = null;
    if (currentSpeedKmh && currentSpeedKmh > 2 && distanceRemainingM > 0) {
      const speedMs = (currentSpeedKmh * 1000) / 3600;
      etaSec = Math.round(distanceRemainingM / speedMs);
    } else if (currentVamMh && currentVamMh > 100 && elevationRemainingM > 0) {
      etaSec = Math.round((elevationRemainingM / currentVamMh) * 3600);
    }

    return (
      <div
        className={`rounded-2xl border border-rose-500/30 bg-[var(--color-surface-climb)]/95 backdrop-blur-md p-4 shadow-2xl relative overflow-hidden ${className}`}
      >
        {/* Glow Superior */}
        <div
          className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
          style={{ backgroundColor: badgeStyle.badgeBg }}
        />

        {/* Top Header da Subida */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span
              style={{ backgroundColor: badgeStyle.badgeBg, color: badgeStyle.badgeText }}
              className="px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-md"
            >
              {badgeStyle.label}
            </span>
            <div>
              <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wide flex items-center gap-1">
                <Mountain size={14} className="text-[var(--color-status-danger)]" />
                <span>
                  {t("climb.climb_n_of_total", {
                    current: currentClimbNumber || 1,
                    total: totalClimbsCount,
                  })}
                </span>
              </h4>
              <p className="text-[10px] text-[var(--muted)]">
                {t("climb.climb_name", { current: currentClimb.climbIndex })} • {t("climb.total", { value: `${formatDistance(currentClimb.distanceM)} (+${Math.round(currentClimb.elevationGainM)}m)` })}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span
              style={{ backgroundColor: `color-mix(in srgb, ${gradeColor} 15%, transparent)`, borderColor: gradeColor, color: "var(--text)" }}
              className="px-2.5 py-1 rounded-lg border text-xs font-black tabular-nums inline-block"
            >
              {formatGrade(currentGradePct)}
            </span>
            <p className="text-[9px] uppercase font-bold text-[var(--muted)] mt-0.5">
              {t("climb.current_grade")}
            </p>
          </div>
        </div>

        {/* Barra de Progresso da Subida com Cores de Gradiente */}
        <div className="relative pt-4 pb-2">
          <div className="h-2.5 w-full rounded-full bg-[var(--surface-hover)] relative overflow-hidden border border-[var(--border)]">
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-300 ease-out"
              style={{
                width: `${climbProgressPct}%`,
                background: "linear-gradient(to right, var(--color-status-warning), var(--color-status-danger))",
              }}
            />
          </div>

          {/* Marcador do Ciclista 🚴 */}
          <div
            className="absolute top-0.5 transform -translate-x-1/2 transition-all duration-300 ease-out flex flex-col items-center z-10"
            style={{ left: `${Math.max(4, Math.min(96, climbProgressPct))}%` }}
          >
            <span className="text-sm leading-none drop-shadow-md">🚴</span>
          </div>

          {/* Bandeira de Cume 🏁 */}
          <div className="absolute right-0 top-0.5 transform translate-x-1/2 flex flex-col items-center">
            <span className="text-xs leading-none">🏁</span>
          </div>
        </div>

        {/* Grid de 4 Métricas de Esforço */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="bg-[var(--surface-hover)] rounded-xl p-2 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">
              {t("climb.remaining_dist")}
            </p>
            <p className="text-sm font-bold text-[var(--text)] tabular-nums mt-0.5">
              {formatDistance(distanceRemainingM)}
            </p>
          </div>

          <div className="bg-[var(--surface-hover)] rounded-xl p-2 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">
              {t("climb.remaining_gain")}
            </p>
            <p className="text-sm font-bold text-[var(--color-status-danger)] tabular-nums mt-0.5">
              +{Math.round(elevationRemainingM)}m
            </p>
          </div>

          <div className="bg-[var(--surface-hover)] rounded-xl p-2 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">
              {t("climb.avg_remaining_grade")}
            </p>
            <p className="text-sm font-bold text-[var(--color-status-warning)] tabular-nums mt-0.5">
              {avgGradeRemainingPct.toFixed(1)}%
            </p>
          </div>

          <div className="bg-[var(--surface-hover)] rounded-xl p-2 border border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">
              {t("climb.eta_summit")}
            </p>
            <p className="text-sm font-bold text-[var(--color-status-info)] tabular-nums mt-0.5 font-mono">
              {etaSec != null ? formatDuration(etaSec) : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 3. Nenhuma subida ativa (mas há subidas futuras na rota)
  if (nextClimb) {
    const badgeStyle = getCategoryBadgeStyle(nextClimb.category);

    return (
      <div
        className={`rounded-2xl border border-[var(--border)] bg-[var(--color-surface-panel-deep)] p-3 shadow-lg flex items-center justify-between ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]">
            <Mountain size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span
                style={{ backgroundColor: badgeStyle.badgeBg, color: badgeStyle.badgeText }}
                className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase"
              >
                {badgeStyle.label}
              </span>
              <p className="text-xs font-bold text-[var(--text)]">
                {t("climb.upcoming_badge")}: {t("climb.climb_name", { current: nextClimb.climbIndex })}
              </p>
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-0.5">
              {formatDistance(nextClimb.distanceM)} @ {nextClimb.avgGradePct.toFixed(1)}% (+{Math.round(nextClimb.elevationGainM)}m)
            </p>
          </div>
        </div>

        {distanceToNextClimbM !== null && (
          <div className="text-right">
            <p className="text-xs font-black text-[var(--color-status-warning)] font-mono">
              {t("climb.in_distance", { value: formatDistance(distanceToNextClimbM) })}
            </p>
            <p className="text-[9px] text-[var(--muted)]">{t("climb.until_start")}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
