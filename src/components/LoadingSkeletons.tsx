import type { CSSProperties, ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

interface SkeletonStatusProps {
  label: string;
  children: ReactNode;
  className?: string;
  testId?: string;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <span aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

function SkeletonStatus({ label, children, className = "", testId }: SkeletonStatusProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      data-testid={testId}
      className={className}
    >
      {children}
    </div>
  );
}

function StatSkeletonGrid({ columns = 4 }: { columns?: number }) {
  return (
    <div className={`grid grid-cols-2 ${columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
      {Array.from({ length: columns }, (_, index) => (
        <div key={index} className="stat-card min-h-[104px]">
          <Skeleton className="h-3.5 w-2/3 mb-3" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-3 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}

function ActivityRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="stat-card overflow-hidden p-0">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="min-h-[74px] border-b border-[var(--border)] px-5 py-3.5 last:border-b-0 flex items-center justify-between gap-4"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <div className="shrink-0 space-y-2 flex flex-col items-end">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityListSkeleton({
  label = "Carregando atividades",
  count = 5,
  withStatus = true,
}: {
  label?: string;
  count?: number;
  withStatus?: boolean;
}) {
  const content = <ActivityRowsSkeleton count={count} />;
  if (!withStatus) return content;
  return (
    <SkeletonStatus label={label} testId="activity-list-skeleton">
      {content}
    </SkeletonStatus>
  );
}

export function DashboardStatsSkeleton({ label = "Carregando estatísticas" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="dashboard-stats-skeleton" className="space-y-6">
      <StatSkeletonGrid />
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-44" />
        </div>
        <ActivityListSkeleton withStatus={false} />
      </section>
    </SkeletonStatus>
  );
}

export function HomeInsightsSkeleton({ label = "Carregando análises" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="home-insights-skeleton" className="space-y-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="stat-card min-h-[112px] space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function InlineSkeleton({ label = "Carregando conteúdo" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="inline-skeleton">
      <div className="stat-card min-h-[92px] flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
    </SkeletonStatus>
  );
}

export function AnalyticsSkeleton({ label = "Carregando análises" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="analytics-skeleton" className="space-y-6">
      <div className="grid grid-cols-2 gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <div className="stat-card min-h-[136px] flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <StatSkeletonGrid columns={6} />
      <div className="stat-card min-h-[250px] space-y-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-[180px] w-full rounded-lg" />
      </div>
    </SkeletonStatus>
  );
}

export function MapSkeleton({
  label = "Carregando mapa / Loading map",
  height = 360,
  className = "",
  withStatus = true,
}: {
  label?: string;
  height?: number;
  className?: string;
  withStatus?: boolean;
}) {
  const content = (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--color-surface-map)]"
      style={{ height }}
    >
      <Skeleton className="absolute left-5 right-5 top-5 h-3 w-1/3" />
      <Skeleton className="absolute left-5 right-20 top-14 h-2 w-2/3" />
      <Skeleton className="absolute left-1/4 top-1/3 h-20 w-20 rounded-full opacity-60" />
      <Skeleton className="absolute bottom-8 right-8 h-3 w-24" />
    </div>
  );

  if (!withStatus) return content;

  return (
    <SkeletonStatus label={label} className={className}>
      {content}
    </SkeletonStatus>
  );
}

export function RoutesSkeleton({ label = "Carregando rotas" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="routes-skeleton" className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="stat-card min-h-[104px] flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
        </div>
      ))}
    </SkeletonStatus>
  );
}

export function ProfileSkeleton({ label = "Carregando perfil" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="profile-skeleton" className="space-y-6">
      <div className="stat-card min-h-[116px] space-y-4">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="stat-card space-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </SkeletonStatus>
  );
}

export function ActivityDetailSkeleton({ label = "Carregando atividade" }: { label?: string }) {
  return (
    <SkeletonStatus label={label} testId="activity-detail-skeleton" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
      <MapSkeleton label={label} height={360} withStatus={false} />
      <StatSkeletonGrid />
    </SkeletonStatus>
  );
}
