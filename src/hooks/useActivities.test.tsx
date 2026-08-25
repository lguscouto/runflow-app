/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActivityDetail, useActivityList, useDashboard } from "./useActivities";
import type { ActivityPage } from "@/lib/storage";
import { listStoredActivitiesPaged } from "@/lib/storage";
import { getActivity, getDashboardStats, listActivities } from "@/lib/activities";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    listStoredActivitiesPaged: vi.fn(),
  };
});

vi.mock("@/lib/activities", async () => {
  const actual = await vi.importActual<typeof import("@/lib/activities")>("@/lib/activities");
  return {
    ...actual,
    getActivity: vi.fn(),
    getDashboardStats: vi.fn(),
    listActivities: vi.fn(),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const page1: ActivityPage = {
  items: [
    {
      id: "a",
      name: "A",
      sport: "running",
      startedAt: "2026-08-24T12:00:00.000Z",
      durationSec: 60,
      distanceM: 100,
      avgPaceSecKm: 600,
      elevationGainM: 0,
      avgHr: null,
      calories: null,
      source: "synthetic-test",
      fileName: null,
      gearId: null,
    },
  ],
  nextCursor: { startedAt: "2026-08-24T12:00:00.000Z", id: "a" },
  hasMore: true,
};

const page2: ActivityPage = {
  items: [{ ...page1.items[0], id: "b", name: "B" }],
  nextCursor: null,
  hasMore: false,
};

describe("useActivityList", () => {
  const listMock = vi.mocked(listStoredActivitiesPaged);
  const dashboardStatsMock = vi.mocked(getDashboardStats);
  const recentMock = vi.mocked(listActivities);
  const activityMock = vi.mocked(getActivity);

  beforeEach(() => {
    listMock.mockReset();
    dashboardStatsMock.mockReset();
    recentMock.mockReset();
    activityMock.mockReset();
  });

  it("serializes concurrent loadMore calls into one storage request", async () => {
    const nextPage = deferred<ActivityPage>();
    listMock.mockResolvedValueOnce(page1).mockReturnValueOnce(nextPage.promise);
    const { result } = renderHook(() => useActivityList(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.loadMore();
      second = result.current.loadMore();
      nextPage.resolve(page2);
      await Promise.all([first, second]);
    });

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(result.current.activities.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("clears loading state, exposes the error and retries the same cursor", async () => {
    listMock.mockResolvedValueOnce(page1).mockRejectedValueOnce(new Error("storage down"));
    const { result } = renderHook(() => useActivityList(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.error).toBe("activities.load_error");

    listMock.mockResolvedValueOnce(page2);
    await act(async () => {
      await result.current.retryLoadMore();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.activities.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("clears dashboard loading and exposes storage failures", async () => {
    dashboardStatsMock.mockRejectedValueOnce(new Error("dashboard storage down"));
    recentMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("activities.load_error");
    expect(result.current.stats).toBeNull();
    expect(result.current.recent).toEqual([]);
  });

  it("clears detail loading and exposes a retryable storage failure", async () => {
    activityMock.mockRejectedValueOnce(new Error("detail storage down"));
    const { result } = renderHook(() => useActivityDetail("activity-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("activities.load_error");
    expect(result.current.notFound).toBe(false);
  });

  it("uses a translatable fallback key for non-Error failures", async () => {
    activityMock.mockRejectedValueOnce("unknown failure");
    const { result } = renderHook(() => useActivityDetail("activity-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("activities.load_error");
  });

  it("does not let a stale detail response overwrite a newer id", async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    activityMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useActivityDetail(id),
      { initialProps: { id: "old" } },
    );

    await waitFor(() => expect(activityMock).toHaveBeenCalledTimes(1));
    rerender({ id: "new" });
    second.resolve({ id: "new", name: "new activity" });
    await waitFor(() => expect(result.current.activity?.id).toBe("new"));

    first.resolve({ id: "old", name: "old activity" });
    await act(async () => {
      await first.promise;
    });
    expect(result.current.activity?.id).toBe("new");
  });
});
