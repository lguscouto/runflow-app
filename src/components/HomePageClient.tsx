"use client";

import Link from "next/link";
import { Play, Upload, Zap } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { ActivityList } from "@/components/ActivityList";
import { WeeklyGoalsCard } from "@/components/WeeklyGoalsCard";
import { useDashboard } from "@/hooks/useActivities";
import { formatDistance, formatDuration } from "@/lib/format";

export function HomePageClient() {
  const { stats, recent, loading } = useDashboard();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Seus treinos de corrida
        </h1>
        <p className="text-[var(--muted)] max-w-xl">
          Grave corridas com GPS no app ou importe do Amazfit — tudo fica no seu
          dispositivo.
        </p>
      </section>

      <Link
        href="/gravar/"
        className="block stat-card border-[var(--accent)]/50 bg-[var(--accent-soft)] hover:border-[var(--accent)] transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full bg-[var(--accent)] flex items-center justify-center text-white shrink-0">
            <Play size={28} fill="currentColor" className="ml-1" />
          </span>
          <div>
            <p className="font-bold text-lg">Iniciar treino</p>
            <p className="text-sm text-[var(--muted)]">
              GPS ao vivo — distância, tempo e ritmo
            </p>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap gap-3">
        <Link href="/importar/" className="btn-ghost">
          <Upload size={18} />
          Importar GPX/FIT
        </Link>
        <Link href="/atividades/" className="btn-ghost">
          Ver todas
        </Link>
      </div>

      <WeeklyGoalsCard />

      {loading || !stats ? (
        <p className="text-[var(--muted)]">Carregando...</p>
      ) : (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Distância total"
              value={formatDistance(stats.totalDistanceM)}
            />
            <StatCard
              label="Tempo total"
              value={formatDuration(stats.totalDurationSec)}
            />
            <StatCard
              label="Esta semana"
              value={formatDistance(stats.thisWeekDistanceM)}
              sub={`${stats.thisWeekActivities} treino(s)`}
            />
            <StatCard
              label="Treinos"
              value={String(stats.totalActivities)}
              sub="registrados"
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Zap size={20} className="text-[var(--accent)]" />
                Atividades recentes
              </h2>
            </div>
            <ActivityList activities={recent} />
          </section>
        </>
      )}
    </div>
  );
}
