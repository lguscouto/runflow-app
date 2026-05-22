"use client";

import { Suspense } from "react";
import { ActivityDetailClient } from "@/components/ActivityDetailClient";
import { useI18n } from "@/lib/i18n";

function Loader() {
  const { t } = useI18n();
  return <p className="text-[var(--muted)]">{t("common.loading")}</p>;
}

export default function ActivityDetailPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ActivityDetailClient />
    </Suspense>
  );
}

