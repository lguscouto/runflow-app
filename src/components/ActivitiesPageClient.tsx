"use client";

import { useEffect, useState } from "react";
import { ActivityList } from "@/components/ActivityList";
import { useActivityList } from "@/hooks/useActivities";
import { getUserProfile } from "@/lib/profile";
import { getPersonalRecords, getPRMap, type PRCategory } from "@/lib/prs";

export function ActivitiesPageClient() {
  const { activities, loading } = useActivityList();
  const [prMap, setPrMap] = useState<Record<string, PRCategory[]>>({});

  useEffect(() => {
    if (activities.length === 0) return;
    async function loadPRs() {
      try {
        const profile = await getUserProfile();
        const prs = getPersonalRecords(activities, profile);
        setPrMap(getPRMap(activities, prs));
      } catch (err) {
        console.error("Erro ao calcular recordes no histórico:", err);
      }
    }
    loadPRs();
  }, [activities]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Atividades</h1>
        <p className="text-[var(--muted)]">
          {loading
            ? "Carregando..."
            : `${activities.length} treino(s) registrado(s)`}
        </p>
      </div>
      {!loading && <ActivityList activities={activities} prMap={prMap} />}
    </div>
  );
}
