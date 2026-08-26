"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeDashboardStats,
  getActivity,
  listActivities,
} from "@/lib/activities";
import {
  countStoredActivities,
  getAllStoredSummaries,
  listStoredActivitiesPaged,
  type ActivityPageCursor,
} from "@/lib/storage";
import type {
  ActivityDetail,
  ActivitySummary,
  DashboardStats,
} from "@/lib/types";

function getErrorMessage(_reason: unknown) {
  return "activities.load_error";
}

function useMountedRef() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<ActivitySummary[]>([]);
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      // Uma única leitura do IndexedDB: as summaries alimentam tanto os stats
      // (derivados em memória) quanto os consumidores de analytics da Home,
      // evitando leituras duplicadas por visita.
      const [list, recentItems] = await Promise.all([
        getAllStoredSummaries(),
        listActivities(5),
      ]);
      if (!mountedRef.current || generation !== generationRef.current) return;
      setSummaries(list);
      setStats(computeDashboardStats(list));
      setRecent(recentItems);
    } catch (reason) {
      if (mountedRef.current && generation === generationRef.current) {
        setError(getErrorMessage(reason));
      }
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [mountedRef]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, recent, summaries, loading, error, refresh };
}

export function useActivityList(pageSize = 50) {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<ActivityPageCursor | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const refreshGenerationRef = useRef(0);
  const mountedRef = useMountedRef();

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current;
    setLoading(true);
    setError(null);

    try {
      const [page, persistedTotal] = await Promise.all([
        listStoredActivitiesPaged(pageSize, null),
        countStoredActivities(),
      ]);
      if (!mountedRef.current || generation !== refreshGenerationRef.current) return;
      setActivities(page.items);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
      setTotalCount(persistedTotal);
    } catch (reason) {
      if (mountedRef.current && generation === refreshGenerationRef.current) {
        setError(getErrorMessage(reason));
      }
    } finally {
      if (mountedRef.current && generation === refreshGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [mountedRef, pageSize]);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !hasMore || !cursor) return;

    const generation = refreshGenerationRef.current;
    const request = (async () => {
      setLoadingMore(true);
      try {
        const page = await listStoredActivitiesPaged(pageSize, cursor);
        if (!mountedRef.current || generation !== refreshGenerationRef.current) return;

        setActivities((previous) => {
          const knownIds = new Set(previous.map((item) => item.id));
          const freshItems = page.items.filter((item) => !knownIds.has(item.id));
          return [...previous, ...freshItems];
        });
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(null);
      } catch (reason) {
        if (mountedRef.current && generation === refreshGenerationRef.current) {
          setError(getErrorMessage(reason));
        }
      } finally {
        if (mountedRef.current) setLoadingMore(false);
      }
    })();

    inFlightRef.current = request;
    try {
      await request;
    } finally {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    }
  }, [cursor, hasMore, mountedRef, pageSize]);

  const retryLoadMore = useCallback(
    () => (cursor ? loadMore() : refresh()),
    [cursor, loadMore, refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    activities,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    error,
    loadMore,
    retryLoadMore,
    refresh,
  };
}

export function useActivityAnalytics(enabled = true) {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!enabled) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextActivities = await getAllStoredSummaries();
      if (!mountedRef.current || generation !== generationRef.current) return;
      setActivities(nextActivities);
    } catch (reason) {
      if (mountedRef.current && generation === generationRef.current) {
        setError(getErrorMessage(reason));
      }
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, mountedRef]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activities, loading, error, refresh };
}

export function useActivityDetail(id: string | null) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useMountedRef();
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (!id) {
      if (mountedRef.current) {
        setLoading(false);
        setNotFound(true);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getActivity(id);
      if (!mountedRef.current || generation !== generationRef.current) return;
      setActivity(data);
      setNotFound(!data);
    } catch (reason) {
      if (mountedRef.current && generation === generationRef.current) {
        setError(getErrorMessage(reason));
      }
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [id, mountedRef]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { activity, loading, notFound, error, refresh };
}
