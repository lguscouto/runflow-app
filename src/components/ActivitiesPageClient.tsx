"use client";

import { ActivityList } from "@/components/ActivityList";
import { useActivityList } from "@/hooks/useActivities";

export function ActivitiesPageClient() {
  const { activities, loading } = useActivityList();

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
      {!loading && <ActivityList activities={activities} />}
    </div>
  );
}
