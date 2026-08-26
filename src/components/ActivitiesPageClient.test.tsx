/** @vitest-environment jsdom */
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivitiesPageClient } from "./ActivitiesPageClient";
import type { ActivitySummary } from "@/lib/types";

const {
  useActivityListMock,
  useActivityAnalyticsMock,
  getPersonalRecordsMock,
  getPRMapMock,
} = vi.hoisted(() => ({
  useActivityListMock: vi.fn(),
  useActivityAnalyticsMock: vi.fn(),
  getPersonalRecordsMock: vi.fn(),
  getPRMapMock: vi.fn(),
}));

vi.mock("@/hooks/useActivities", () => ({
  useActivityList: useActivityListMock,
  useActivityAnalytics: useActivityAnalyticsMock,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      key === "activities.registered_count"
        ? `Registradas: ${values?.count}`
        : key,
  }),
}));

vi.mock("@/lib/profile", () => ({
  getUserProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/prs", () => ({
  getPersonalRecords: getPersonalRecordsMock,
  getPRMap: getPRMapMock,
}));

vi.mock("@/components/ActivityList", () => ({
  ActivityList: ({
    activities,
    prMap,
  }: {
    activities: ActivitySummary[];
    prMap: Record<string, string[]>;
  }) =>
    createElement(
      "div",
      { "data-testid": "activity-list", "data-pr-map": JSON.stringify(prMap) },
      `visible:${activities.length}`,
    ),
}));

vi.mock("@/components/AdvancedStatsPanel", () => ({
  AdvancedStatsPanel: ({ activities }: { activities: ActivitySummary[] }) =>
    createElement("div", { "data-testid": "stats-panel" }, `stats:${activities.length}`),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => createElement("div", { "data-testid": "heatmap" }),
}));

const visibleActivities = Array.from({ length: 50 }, (_, index) => ({
  id: `visible-${index}`,
})) as ActivitySummary[];
const allActivities = Array.from({ length: 120 }, (_, index) => ({
  id: `all-${index}`,
})) as ActivitySummary[];
const noAnalyticsActivities: ActivitySummary[] = [];

describe("ActivitiesPageClient analytics boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActivityListMock.mockReturnValue({
      activities: visibleActivities,
      loading: false,
      loadingMore: false,
      hasMore: true,
      loadMore: vi.fn(),
      refresh: vi.fn(),
      totalCount: 120,
      error: null,
      retryLoadMore: vi.fn(),
    });
    useActivityAnalyticsMock.mockImplementation((enabled: boolean) => ({
      activities: enabled ? allActivities : noAnalyticsActivities,
      loading: false,
      error: null,
      refresh: vi.fn(),
    }));
    getPersonalRecordsMock.mockReturnValue({});
    getPRMapMock.mockReturnValue({});
  });

  it("defers full-history analytics until the statistics tab is opened", async () => {
    render(createElement(ActivitiesPageClient));

    expect(screen.getByText("Registradas: 120")).toBeTruthy();
    expect(useActivityAnalyticsMock).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "stats.tab_charts" }));
    await waitFor(() => expect(useActivityAnalyticsMock).toHaveBeenLastCalledWith(true));
  });

  it("computes visible PR badges without enabling the full-history analytics load", async () => {
    const visiblePrMap = { "visible-0": ["longestDistance"] };
    getPRMapMock.mockReturnValue(visiblePrMap);

    render(createElement(ActivitiesPageClient));

    await waitFor(() => {
      expect(getPersonalRecordsMock).toHaveBeenCalledWith(visibleActivities, null);
    });
    expect(useActivityAnalyticsMock).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("activity-list").getAttribute("data-pr-map")).toBe(
      JSON.stringify(visiblePrMap),
    );
  });

  it("feeds the statistics tab with all summaries, not only the visible page", async () => {
    render(createElement(ActivitiesPageClient));
    fireEvent.click(screen.getByRole("button", { name: "stats.tab_charts" }));

    const statsPanel = await screen.findByTestId("stats-panel");
    expect(statsPanel.textContent).toBe("stats:120");
  });

  it("renders localized analytics failure and retry labels", async () => {
    useActivityAnalyticsMock.mockReturnValue({
      activities: [],
      loading: false,
      error: "storage down",
      refresh: vi.fn(),
    });

    render(createElement(ActivitiesPageClient));
    fireEvent.click(screen.getByRole("button", { name: "stats.tab_charts" }));

    expect(await screen.findByText("activities.stats_load_error")).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.retry" })).toBeTruthy();
  });

  it("renders a structural list skeleton while the first page is loading", () => {
    useActivityListMock.mockReturnValue({
      activities: [],
      loading: true,
      loadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
      refresh: vi.fn(),
      totalCount: 0,
      error: null,
      retryLoadMore: vi.fn(),
    });

    render(createElement(ActivitiesPageClient));

    expect(screen.getByTestId("activity-list-skeleton")).toBeTruthy();
    expect(screen.getByRole("status", { name: "common.loading" })).toBeTruthy();
  });

  it("renders a chart-shaped skeleton while full-history analytics loads", async () => {
    useActivityAnalyticsMock.mockReturnValue({
      activities: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(createElement(ActivitiesPageClient));
    fireEvent.click(screen.getByRole("button", { name: "stats.tab_charts" }));

    expect(await screen.findByTestId("analytics-skeleton")).toBeTruthy();
  });
});
