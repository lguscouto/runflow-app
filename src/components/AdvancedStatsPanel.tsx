"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Clock,
  Gauge,
  Flame,
  Heart,
  Calendar,
  Trophy,
  Activity,
} from "lucide-react";
import type { ActivitySummary } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import {
  filterActivities,
  calculateMetrics,
  getYearlyAccumulated,
  getChartData,
  type StatsPeriod,
  type StatsSportFilter,
} from "@/lib/stats";
import {
  formatDistance,
  formatDuration,
  formatPace,
  formatCalories,
} from "@/lib/format";
import { VolumeBarChart } from "./VolumeBarChart";

interface AdvancedStatsPanelProps {
  activities: ActivitySummary[];
}

export function AdvancedStatsPanel({ activities }: AdvancedStatsPanelProps) {
  const { t, language } = useI18n();
  const [period, setPeriod] = useState<StatsPeriod>("12w");
  const [sport, setSport] = useState<StatsSportFilter>("all");

  // 1. Filter activities based on selection
  const filteredActivities = useMemo(() => {
    return filterActivities(activities, period, sport);
  }, [activities, period, sport]);

  // 2. Compute aggregated metrics for the filtered period/sport
  const metrics = useMemo(() => {
    return calculateMetrics(filteredActivities);
  }, [filteredActivities]);

  // 3. Compute yearly accumulated totals (anchored to current calendar year, all sports or filtered sport)
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const yearlyAccumulated = useMemo(() => {
    // Filter activities by the selected sport for a fairer comparison, or always show all sports?
    // Let's filter by the selected sport so the yearly comparison matches the sport type being analyzed.
    const sportFiltered = activities.filter((a) => sport === "all" || a.sport === sport);
    return getYearlyAccumulated(sportFiltered, currentYear);
  }, [activities, sport, currentYear]);

  // 4. Generate grouped data for weekly/monthly charts
  const chartData = useMemo(() => {
    return getChartData(filteredActivities, period, language);
  }, [filteredActivities, period, language]);

  // Helper to format average pace
  const paceDisplay = useMemo(() => {
    return formatPace(metrics.avgPaceSecKm);
  }, [metrics.avgPaceSecKm]);

  // Helper to format average heart rate
  const hrDisplay = useMemo(() => {
    return metrics.avgHr ? `${metrics.avgHr} bpm` : "—";
  }, [metrics.avgHr]);

  // Helper to format total duration
  const durationDisplay = useMemo(() => {
    return formatDuration(metrics.totalDurationSec);
  }, [metrics.totalDurationSec]);

  // Helper to format yearly duration in a readable format
  const formatYearlyDuration = (hours: number) => {
    if (hours === 0) return "0h";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Filters section */}
      <div className="grid grid-cols-2 gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
            {t("stats.filter_period")}
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as StatsPeriod)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer transition-colors"
          >
            <option value="4w">{t("stats.period_4w")}</option>
            <option value="12w">{t("stats.period_12w")}</option>
            <option value="year">{t("stats.period_year")}</option>
            <option value="all">{t("stats.period_all")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">
            {t("stats.filter_sport")}
          </label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as StatsSportFilter)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)] cursor-pointer transition-colors"
          >
            <option value="all">{t("stats.sport_all")}</option>
            <option value="running">{t("sport.running")}</option>
            <option value="walking">{t("sport.walking")}</option>
            <option value="cycling">{t("sport.cycling")}</option>
            <option value="other">{t("sport.other")}</option>
          </select>
        </div>
      </div>

      {/* Yearly Accumulator Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--surface)] to-[var(--accent-soft)] border border-[var(--border)] rounded-xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Subtle decorative background trophy */}
        <div className="absolute right-[-10px] bottom-[-20px] opacity-5 pointer-events-none">
          <Trophy size={140} className="text-[var(--accent)]" />
        </div>
        
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[var(--accent)] text-white rounded-xl shadow-inner shrink-0 mt-0.5">
            <Trophy size={24} />
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--text)] mb-1">
              {t("stats.yearly_accumulated", { year: currentYear })}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {sport === "all"
                ? "Resumo anual consolidado de todas as atividades"
                : `Resumo anual consolidado de ${t(`sport.${sport}`).toLowerCase()}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 sm:gap-8 border-t border-[var(--border)] sm:border-t-0 pt-4 sm:pt-0">
          <div>
            <span className="block text-[var(--muted)] text-[10px] font-bold uppercase tracking-wider">
              {t("goals.distance")}
            </span>
            <span className="text-lg font-extrabold text-[var(--accent)]">
              {yearlyAccumulated.distanceKm.toFixed(1)} km
            </span>
          </div>
          <div>
            <span className="block text-[var(--muted)] text-[10px] font-bold uppercase tracking-wider">
              {t("home.total_duration")}
            </span>
            <span className="text-lg font-extrabold text-[var(--text)]">
              {formatYearlyDuration(yearlyAccumulated.durationHours)}
            </span>
          </div>
          <div>
            <span className="block text-[var(--muted)] text-[10px] font-bold uppercase tracking-wider">
              {t("home.workouts")}
            </span>
            <span className="text-lg font-extrabold text-[var(--text)]">
              {yearlyAccumulated.workoutsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("goals.distance")}</span>
            <TrendingUp size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {formatDistance(metrics.totalDistanceM)}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Acumulado no período</span>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("home.total_duration")}</span>
            <Clock size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {durationDisplay}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Tempo em movimento</span>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("stats.avg_pace")}</span>
            <Gauge size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {paceDisplay}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Média ponderada</span>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("home.workouts")}</span>
            <Activity size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {metrics.totalWorkouts}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Atividades concluídas</span>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("stats.total_calories")}</span>
            <Flame size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {formatCalories(metrics.totalCalories)}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Estimativa total</span>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--muted)]">{t("stats.avg_hr")}</span>
            <Heart size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-2xl font-bold tracking-tight block">
              {hrDisplay}
            </span>
            <span className="text-[10px] text-[var(--muted)]">Ponderada por tempo</span>
          </div>
        </div>
      </div>

      {/* Chart Panels */}
      {filteredActivities.length > 0 ? (
        <div className="space-y-6">
          <div className="stat-card">
            <h3 className="font-bold text-sm text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
              {t(period === "4w" || period === "12w" ? "stats.distance_weekly" : "stats.distance_monthly")}
            </h3>
            <VolumeBarChart data={chartData} valueKey="distanceKm" />
          </div>

          <div className="stat-card">
            <h3 className="font-bold text-sm text-[var(--text)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>
              {t(period === "4w" || period === "12w" ? "stats.duration_weekly" : "stats.duration_monthly")}
            </h3>
            <VolumeBarChart data={chartData} valueKey="durationMin" />
          </div>
        </div>
      ) : (
        <div className="stat-card text-center py-12 text-sm text-[var(--muted)]">
          {t("stats.no_activities")}
        </div>
      )}
    </div>
  );
}
