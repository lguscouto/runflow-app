"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getActivity,
  getDashboardStats,
  listActivities,
} from "@/lib/activities";
import {
  listStoredActivitiesPaged,
  type ActivityPageCursor,
} from "@/lib/storage";
import type {
  ActivityDetail,
  ActivitySummary,
  DashboardStats,
} from "@/lib/types";

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, list] = await Promise.all([
      getDashboardStats(),
      listActivities(5),
    ]);
    setStats(s);
    setRecent(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, recent, loading, refresh };
}

export function useActivityList(pageSize = 50) {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<ActivityPageCursor | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const page = await listStoredActivitiesPaged(pageSize, null);
    setActivities(page.items);
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setLoading(false);
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    const page = await listStoredActivitiesPaged(pageSize, cursor);
    setActivities((prev) => [...prev, ...page.items]);
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setLoadingMore(false);
  }, [pageSize, cursor, hasMore, loadingMore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activities, loading, loadingMore, hasMore, loadMore, refresh };
}

export function useActivityDetail(id: string | null) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    setLoading(true);
    const data = await getActivity(id);
    setActivity(data);
    setNotFound(!data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activity, loading, notFound, refresh };
}
