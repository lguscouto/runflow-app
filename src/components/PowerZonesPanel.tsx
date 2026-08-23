"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Zap,
  Activity,
  Flame,
  Info,
  TrendingUp,
  ShieldCheck,
  Gauge,
  Sparkles,
} from "lucide-react";
import type { ActivityDetail, UserProfile } from "@/lib/types";
import { getUserProfile } from "@/lib/profile";
import { useI18n } from "@/lib/i18n";
import { analyzeActivityPowerZones } from "@/lib/power-zones";
import { formatDuration, formatWatts } from "@/lib/format";

interface PowerZonesPanelProps {
  activity: ActivityDetail;
}

export function PowerZonesPanel({ activity }: PowerZonesPanelProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserProfile | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    getUserProfile().then((p) => {
      if (isMounted && p) setProfile(p);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const analysis = useMemo(() => {
    return analyzeActivityPowerZones(activity, profile);
  }, [activity, profile]);

  if (!analysis.hasPower) {
    return null;
  }

  const getIfBadgeColor = (ifVal?: number) => {
    if (!ifVal) return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    if (ifVal < 0.75) return "bg-sky-500/15 text-sky-400 border-sky-500/30";
    if (ifVal < 0.85) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (ifVal < 0.95) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-rose-500/15 text-rose-400 border-rose-500/30";
  };

  return (
    <section className="stat-card space-y-6 border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Zap size={20} className="fill-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <span>{t("power_zones.title")}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Coggan 7 Zonas
              </span>
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {t("power_zones.subtitle")} • FTP Base: <strong className="text-white font-mono">{analysis.ftpWatts} W</strong>
            </p>
          </div>
        </div>

        {/* Chips: Potência Média e Máxima */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
            <span className="text-[var(--muted)]">{t("power_zones.avg_watts_label")}:</span>
            <span className="text-amber-400 font-bold font-mono">{formatWatts(analysis.avgWatts)}</span>
          </div>
          {analysis.maxWatts > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
              <span className="text-[var(--muted)]">{t("power_zones.max_watts_label")}:</span>
              <span className="text-rose-400 font-bold font-mono">{formatWatts(analysis.maxWatts)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Cycling Power Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Potência Normalizada (NP) */}
        <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
            <span>NP™ (Coggan)</span>
            <span title={t("power_zones.np_tooltip")} className="cursor-help text-[var(--muted)]">
              <Info size={12} />
            </span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-300 font-mono tracking-tight">
              {analysis.normalizedPowerWatts ? formatWatts(analysis.normalizedPowerWatts).replace(" W", "") : "—"}
            </span>
            <span className="text-xs text-[var(--muted)] font-normal">W</span>
          </div>
        </div>

        {/* Fator de Intensidade (IF) */}
        <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
              <span>IF (Intensidade)</span>
              <span title={t("power_zones.if_tooltip")} className="cursor-help text-[var(--muted)]">
                <Info size={12} />
              </span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-white font-mono tracking-tight">
              {analysis.intensityFactor !== undefined ? analysis.intensityFactor.toFixed(2) : "—"}
            </span>
            {analysis.intensityFactor !== undefined && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getIfBadgeColor(analysis.intensityFactor)}`}>
                {analysis.intensityFactor < 0.75 ? "Leve" : analysis.intensityFactor < 0.85 ? "Moderado" : analysis.intensityFactor < 0.95 ? "Forte" : "Máximo"}
              </span>
            )}
          </div>
        </div>

        {/* Training Stress Score (TSS) */}
        <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
            <span>TSS (Carga)</span>
            <span title={t("power_zones.tss_tooltip")} className="cursor-help text-[var(--muted)]">
              <Info size={12} />
            </span>
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-400 font-mono tracking-tight">
              {analysis.trainingStressScore !== undefined ? analysis.trainingStressScore : "—"}
            </span>
            <span className="text-xs text-[var(--muted)]">pts</span>
          </div>
        </div>

        {/* Watts por Quilo (W/kg) */}
        <div className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
            <span>Relação W/kg</span>
            <span title={t("power_zones.wkg_tooltip")} className="cursor-help text-[var(--muted)]">
              <Info size={12} />
            </span>
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-cyan-400 font-mono tracking-tight">
              {analysis.wattsPerKg !== undefined ? analysis.wattsPerKg.toFixed(2) : "—"}
            </span>
            <span className="text-xs text-[var(--muted)]">W/kg</span>
          </div>
        </div>
      </div>

      {/* Proportional Stacked Zone Bar (Z1 to Z7) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>{t("power_zones.distribution_label")}</span>
          {analysis.dominantZone && (
            <span className="font-semibold text-amber-400">
              Zona Dominante: Z{analysis.dominantZone}
            </span>
          )}
        </div>
        <div className="h-3.5 w-full rounded-full bg-[var(--bg)] border border-[var(--border)] overflow-hidden flex shadow-inner">
          {analysis.zones.map((item) => {
            if (item.percent <= 0) return null;
            return (
              <div
                key={item.zone.zone}
                style={{
                  width: `${item.percent}%`,
                  backgroundColor: item.zone.color,
                }}
                className="h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                title={`Z${item.zone.zone} (${t(item.zone.nameKey)}): ${item.percent}% (${formatDuration(item.durationSec)})`}
              />
            );
          })}
        </div>
      </div>

      {/* 7 Coggan Zones Detailed List */}
      <div className="space-y-2">
        {analysis.zones.map((item) => {
          const isDominant = analysis.dominantZone === item.zone.zone;

          return (
            <div
              key={item.zone.zone}
              className={`p-3 rounded-xl border transition-all ${
                isDominant
                  ? "bg-[var(--surface-raised)] border-amber-500/40 shadow-sm"
                  : "bg-[var(--bg)]/70 border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                {/* Zone Badge + Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    style={{
                      backgroundColor: item.zone.bgRgba,
                      color: item.zone.color,
                      borderColor: item.zone.color,
                    }}
                    className="px-2 py-0.5 rounded-lg border text-xs font-black shrink-0 font-mono"
                  >
                    Z{item.zone.zone}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)] truncate flex items-center gap-1.5">
                      <span>{t(item.zone.nameKey)}</span>
                      {isDominant && (
                        <span className="text-[10px] text-amber-400 font-bold font-mono">
                          ★ Principal
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] truncate font-mono">
                      {item.zone.zone === 1
                        ? `< ${item.zone.maxWatts} W (< 55% FTP)`
                        : item.zone.zone === 7
                        ? `> ${item.zone.minWatts} W (> 150% FTP)`
                        : `${item.zone.minWatts} - ${item.zone.maxWatts} W (${Math.round(item.zone.minPct * 100)}% - ${Math.round(item.zone.maxPct * 100)}% FTP)`}
                    </p>
                  </div>
                </div>

                {/* Time & Percentage */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-[var(--text)] block font-mono">
                    {formatDuration(item.durationSec)}
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--muted)]">
                    {item.percent}%
                  </span>
                </div>
              </div>

              {/* Progress Track for this Zone */}
              <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: item.zone.color,
                  }}
                  className="h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
