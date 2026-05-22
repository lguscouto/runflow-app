"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getActivity,
  getDashboardStats,
  listActivities,
} from "@/lib/activities";
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

export function useActivityList(limit = 200) {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setActivities(await listActivities(limit));
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activities, loading, refresh };
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
