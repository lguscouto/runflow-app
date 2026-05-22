import { Suspense } from "react";
import { ActivityDetailClient } from "@/components/ActivityDetailClient";

export default function ActivityDetailPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">Carregando...</p>}>
      <ActivityDetailClient />
    </Suspense>
  );
}
