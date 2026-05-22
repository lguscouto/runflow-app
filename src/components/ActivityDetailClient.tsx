"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Flame, Heart, Mountain, Timer, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { getUserProfile } from "@/lib/profile";
import { listActivities } from "@/lib/activities";
import { getPersonalRecords, getActivityPRs, type PRCategory, PR_CATEGORY_LABELS } from "@/lib/prs";

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((m) => m.ActivityMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
        style={{ height: "360px" }}
      />
    ),
  }
);
import { DeleteActivityButton } from "@/components/DeleteActivityButton";
import { ActivityCharts } from "@/components/ActivityCharts";
import { ExportGpxButton } from "@/components/ExportGpxButton";
import { ActivitySplits } from "@/components/ActivitySplits";
import { useActivityDetail } from "@/hooks/useActivities";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatCalories,
  formatElevation,
  formatPace,
  sportLabel,
} from "@/lib/format";

export function ActivityDetailClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { activity, loading, notFound } = useActivityDetail(id);
  const [prCategories, setPrCategories] = useState<PRCategory[]>([]);

  useEffect(() => {
    if (!activity) return;
    const activityId = activity.id;
    async function checkPR() {
      try {
        const [profile, allActivities] = await Promise.all([
          getUserProfile(),
          listActivities(1000),
        ]);
        const prs = getPersonalRecords(allActivities, profile);
        const { isPR, categories } = getActivityPRs(activityId, prs);
        if (isPR) {
          setPrCategories(categories);
        }
      } catch (err) {
        console.error("Erro ao verificar PR do treino:", err);
      }
    }
    checkPR();
  }, [activity]);

  if (!id || notFound) {
    return (
      <p className="text-[var(--muted)]">
        Treino não encontrado.{" "}
        <Link href="/atividades/" className="text-[var(--accent)]">
          Voltar
        </Link>
      </p>
    );
  }

  if (loading || !activity) {
    return <p className="text-[var(--muted)]">Carregando treino...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/atividades/"
            className="text-sm text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={14} />
            Voltar
          </Link>
          <h1 className="text-2xl font-bold">{activity.name}</h1>
          <p className="text-[var(--muted)]">
            {sportLabel(activity.sport)} · {formatDate(activity.startedAt)}
            {activity.source === "recorded"
              ? " · Gravado no RunFlow"
              : activity.fileName && ` · ${activity.fileName}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ExportGpxButton activity={activity} />
          <DeleteActivityButton id={activity.id} />
        </div>
      </div>

      {prCategories.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
          <Trophy className="text-amber-500 shrink-0" size={28} />
          <div>
            <p className="font-semibold text-base text-amber-500 flex items-center gap-1.5 animate-pulse">
              Recorde Pessoal Batido! 🏆
            </p>
            <p className="text-sm text-[var(--muted)] leading-normal mt-0.5">
              Este treino estabeleceu sua melhor marca em:{" "}
              <strong className="font-semibold text-[var(--text)]">
                {prCategories.map((cat) => PR_CATEGORY_LABELS[cat]).join(", ")}
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      <ActivityMap points={activity.points} height="360px" />

      <ActivityCharts activity={activity} />

      <ActivitySplits points={activity.points} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">Distância</p>
          <p className="text-xl font-bold text-[var(--accent)]">
            {formatDistance(activity.distanceM)}
          </p>
        </div>
        <div className="stat-card flex gap-2">
          <Timer className="text-[var(--muted)] shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">Duração</p>
            <p className="text-xl font-bold">
              {formatDuration(activity.durationSec)}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <p className="text-sm text-[var(--muted)]">Ritmo médio</p>
          <p className="text-xl font-bold">
            {formatPace(activity.avgPaceSecKm)}
          </p>
        </div>
        <div className="stat-card flex gap-2">
          <Mountain className="text-[var(--muted)] shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">Elevação</p>
            <p className="text-xl font-bold">
              {formatElevation(activity.elevationGainM)}
            </p>
          </div>
        </div>
        <div className="stat-card flex gap-2">
          <Flame className="text-orange-400 shrink-0 mt-1" size={18} />
          <div>
            <p className="text-sm text-[var(--muted)]">Calorias</p>
            <p className="text-xl font-bold">
              {formatCalories(activity.calories)}
            </p>
            {activity.calories != null && activity.calories > 0 && (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {activity.source === "fit" || activity.source === "gpx"
                  ? "Do arquivo ou estimada"
                  : "Estimada pelo perfil"}
              </p>
            )}
          </div>
        </div>
        {activity.avgHr != null && (
          <div className="stat-card flex gap-2">
            <Heart className="text-red-400 shrink-0 mt-1" size={18} />
            <div>
              <p className="text-sm text-[var(--muted)]">FC média / máx</p>
              <p className="text-xl font-bold">
                {activity.avgHr}
                {activity.maxHr != null && ` / ${activity.maxHr}`} bpm
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
