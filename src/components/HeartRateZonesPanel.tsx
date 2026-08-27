"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Heart,
  Activity,
  Flame,
  Zap,
  Info,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import type { ActivityDetail, UserProfile } from "@/lib/types";
import { getUserProfile } from "@/lib/profile";
import { useI18n } from "@/lib/i18n";
import { getZoneColorVar } from "@/lib/color-tokens";
import { analyzeActivityHeartRate } from "@/lib/hr-zones";
import { formatDuration } from "@/lib/format";

interface HeartRateZonesPanelProps {
  activity: ActivityDetail;
}

export function HeartRateZonesPanel({ activity }: HeartRateZonesPanelProps) {
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
    return analyzeActivityHeartRate(activity, profile);
  }, [activity, profile]);

  if (!analysis.hasHeartRate) {
    return null;
  }

  const getLoadBadgeColor = (label: string) => {
    switch (label) {
      case "light":
        return "bg-slate-500/15 text-[var(--muted)] border-slate-500/30";
      case "moderate":
        return "bg-sky-500/15 text-[var(--color-status-info)] border-sky-500/30";
      case "optimal":
        return "bg-emerald-500/15 text-[var(--color-status-positive)] border-emerald-500/30";
      case "extreme":
        return "bg-rose-500/15 text-[var(--color-status-danger)] border-rose-500/30";
      default:
        return "bg-amber-500/15 text-[var(--color-status-warning)] border-amber-500/30";
    }
  };

  const getEffectIcon = (effect: string) => {
    switch (effect) {
      case "recovery":
        return <ShieldCheck size={18} className="text-[var(--muted)] shrink-0" />;
      case "aerobic_base":
        return <TrendingUp size={18} className="text-[var(--color-status-info)] shrink-0" />;
      case "tempo":
        return <Activity size={18} className="text-[var(--color-status-positive)] shrink-0" />;
      case "threshold":
        return <Flame size={18} className="text-[var(--color-status-warning)] shrink-0" />;
      case "anaerobic_vo2":
        return <Zap size={18} className="text-[var(--color-status-danger)] shrink-0" />;
      default:
        return <Activity size={18} className="text-[var(--accent)] shrink-0" />;
    }
  };

  return (
    <section className="stat-card space-y-6 border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-[var(--color-status-danger)] flex items-center justify-center shrink-0">
            <Heart size={20} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              {t("hr_zones.title")}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {t("hr_zones.subtitle")}
            </p>
          </div>
        </div>

        {/* FC Média & Pico Chips */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
            <span className="text-[var(--muted)]">{t("hr_zones.avg_hr_label")}:</span>
            <span className="text-[var(--text)] font-bold">{analysis.avgHr} bpm</span>
          </div>
          {analysis.peakHr > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center gap-1.5">
              <span className="text-[var(--muted)]">{t("hr_zones.peak_hr_label")}:</span>
              <span className="text-[var(--color-status-danger)] font-bold">{analysis.peakHr} bpm</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards: Foco Cardiovascular & Carga TRIMP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Foco Fisiológico */}
        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] block">
            {t("hr_zones.effect_title")}
          </span>
          <div className="flex items-center gap-2.5">
            {getEffectIcon(analysis.trainingEffect)}
            <span className="text-sm font-bold text-[var(--text)]">
              {t(`hr_zones.effect_${analysis.trainingEffect}`)}
            </span>
          </div>
        </div>

        {/* Carga TRIMP */}
        <div className="p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
              {t("hr_zones.trimp_title")}
              <span title={t("hr_zones.trimp_tooltip")} className="cursor-help text-[var(--muted)]">
                <Info size={13} />
              </span>
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getLoadBadgeColor(analysis.trainingLoadLabel)}`}>
              {t(`hr_zones.load_${analysis.trainingLoadLabel}`)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text)] tracking-tight">
              {analysis.trimpScore}
            </span>
            <span className="text-xs text-[var(--muted)]">pts</span>
          </div>
        </div>
      </div>

      {/* Proportional Stacked Zone Bar */}
      <div className="space-y-2">
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
                className="h-full transition-all duration-500 hover:opacity-90"
                title={`${t(item.zone.nameKey)}: ${item.percent}% (${formatDuration(item.durationSec)})`}
              />
            );
          })}
        </div>
      </div>

      {/* Zone Details Breakdown Table / List */}
      <div className="space-y-2.5">
        {analysis.zones.map((item) => {
          const isDominant = analysis.dominantZone === item.zone.zone;

          return (
            <div
              key={item.zone.zone}
              className={`p-3 rounded-xl border transition-all ${
                isDominant
                  ? "bg-[var(--surface-raised)] border-[var(--accent)]/40 shadow-sm"
                  : "bg-[var(--bg)]/70 border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                {/* Zone Badge + Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    style={{
                      backgroundColor: getZoneColorVar("hr", item.zone.zone),
                      color: "var(--color-zone-badge-foreground)",
                      borderColor: getZoneColorVar("hr", item.zone.zone),
                    }}
                    className="px-2 py-0.5 rounded-lg border text-xs font-black shrink-0"
                  >
                    Z{item.zone.zone}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text)] truncate">
                      {t(item.zone.nameKey)}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] truncate">
                      {t("hr_zones.bpm_range", { min: item.zone.minBpm, max: item.zone.maxBpm })}
                    </p>
                  </div>
                </div>

                {/* Time & Percentage */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-[var(--text)] block">
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
