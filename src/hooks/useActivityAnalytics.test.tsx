/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countStoredActivities,
  getAllStoredSummaries,
  listStoredActivitiesPaged,
} from "@/lib/storage";
import { useActivityAnalytics, useActivityList } from "./useActivities";
import { makeStoredActivity } from "../../tests/fixtures/activityFactory";
import { toActivitySummary, type ActivityPage } from "@/lib/storage";

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    countStoredActivities: vi.fn(),
    getAllStoredSummaries: vi.fn(),
    listStoredActivitiesPaged: vi.fn(),
  };
});

const summaries = Array.from({ length: 120 }, (_, index) =>
  toActivitySummary(
    makeStoredActivity({
      id: `analytics-${index}`,
      startedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    }),
  ),
);

const firstPage: ActivityPage = {
  items: summaries.slice(0, 50),
  nextCursor: { startedAt: summaries[49].startedAt, id: summaries[49].id },
  hasMore: true,
};

describe("activity history analytics", () => {
  const countMock = vi.mocked(countStoredActivities);
  const summariesMock = vi.mocked(getAllStoredSummaries);
  const pageMock = vi.mocked(listStoredActivitiesPaged);

  beforeEach(() => {
    countMock.mockReset();
    summariesMock.mockReset();
    pageMock.mockReset();
  });

  it("loads all lightweight summaries for analytics, independently of the visible page", async () => {
    summariesMock.mockResolvedValue(summaries);
    const { result } = renderHook(() => useActivityAnalytics());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activities).toHaveLength(120);
    expect(result.current.activities[119].id).toBe("analytics-119");
    expect(result.current.error).toBeNull();
  });

  it("returns persisted total count while the list remains paginated", async () => {
    countMock.mockResolvedValue(120);
    pageMock.mockResolvedValue(firstPage);
    const { result } = renderHook(() => useActivityList(50));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activities).toHaveLength(50);
    expect(result.current.totalCount).toBe(120);
  });
});
