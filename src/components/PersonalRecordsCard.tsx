"use client";

import Link from "next/link";
import { Trophy, Zap, Clock, Compass, Landmark } from "lucide-react";
import { PersonalRecords } from "@/lib/prs";
import { formatDistance, formatDuration, formatPace, formatElevation } from "@/lib/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PersonalRecordsCardProps {
  prs: PersonalRecords;
}

export function PersonalRecordsCard({ prs }: PersonalRecordsCardProps) {
  const { longestDistance, bestPace, longestDuration, highestElevation } = prs;

  const hasAnyPR = !!(longestDistance || bestPace || longestDuration || highestElevation);

  if (!hasAnyPR) {
    return (
      <section className="stat-card">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-amber-500 shrink-0" />
          <div>
            <p className="font-semibold text-lg">Recordes Pessoais</p>
            <p className="text-sm text-[var(--muted)]">
              Complete treinos de corrida para registrar seus recordes aqui!
            </p>
          </div>
        </div>
      </section>
    );
  }

  const items = [
    {
      id: "longestDistance",
      label: "Maior Distância",
      activity: longestDistance,
      value: longestDistance ? formatDistance(longestDistance.distanceM) : "—",
      icon: <Compass className="text-blue-400" size={18} />,
      bgClass: "bg-blue-500/10 border-blue-500/20",
    },
    {
      id: "bestPace",
      label: "Melhor Ritmo",
      activity: bestPace,
      value: bestPace ? formatPace(bestPace.avgPaceSecKm) : "—",
      icon: <Zap className="text-amber-500" size={18} />,
      bgClass: "bg-amber-500/10 border-amber-500/20",
    },
    {
      id: "longestDuration",
      label: "Maior Duração",
      activity: longestDuration,
      value: longestDuration ? formatDuration(longestDuration.durationSec) : "—",
      icon: <Clock className="text-emerald-400" size={18} />,
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      id: "highestElevation",
      label: "Maior Subida",
      activity: highestElevation,
      value: highestElevation ? formatElevation(highestElevation.elevationGainM) : "—",
      icon: <Landmark className="text-purple-400" size={18} />,
      bgClass: "bg-purple-500/10 border-purple-500/20",
    },
  ];

  return (
    <section className="stat-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy size={20} className="text-amber-500 animate-bounce" />
          Recordes Pessoais
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const act = item.activity;
          const content = (
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
                  {item.label}
                </span>
                <span className={`p-1.5 rounded-lg border ${item.bgClass}`}>
                  {item.icon}
                </span>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold tracking-tight text-[var(--text)]">
                  {item.value}
                </p>
                {act ? (
                  <p className="text-[10px] text-[var(--muted)] mt-1 truncate">
                    {format(new Date(act.startedAt), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                ) : (
                  <p className="text-[10px] text-[var(--muted)] mt-1">
                    Sem registro
                  </p>
                )}
              </div>
            </div>
          );

          if (act) {
            return (
              <Link
                key={item.id}
                href={`/atividade/${act.id}`}
                className="block p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--accent)] hover:shadow-sm transition-all duration-200"
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 opacity-60"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
