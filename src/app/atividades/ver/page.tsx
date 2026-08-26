"use client";

import { Suspense } from "react";
import { ActivityDetailClient } from "@/components/ActivityDetailClient";
import { ActivityDetailSkeleton } from "@/components/LoadingSkeletons";
import { useI18n } from "@/lib/i18n";

function Loader() {
  const { t } = useI18n();
  return <ActivityDetailSkeleton label={t("common.loading")} />;
}

export default function ActivityDetailPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ActivityDetailClient />
    </Suspense>
  );
}

