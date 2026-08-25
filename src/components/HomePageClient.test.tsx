/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePageClient } from "./HomePageClient";

const { useDashboardMock, refreshMock } = vi.hoisted(() => ({
  useDashboardMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, prefetch: _prefetch, ...props }: { children: ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/hooks/useActivities", () => ({ useDashboard: useDashboardMock }));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, language: "en" }),
}));
vi.mock("@/lib/profile", () => ({ getUserProfile: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/lib/storage", () => ({ getAllStoredSummaries: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/components/WeeklyGoalsCard", () => ({ WeeklyGoalsCard: () => null }));
vi.mock("@/components/ConsistencyStreakCard", () => ({ ConsistencyStreakCard: () => null }));
vi.mock("@/components/PersonalRecordsCard", () => ({ PersonalRecordsCard: () => null }));
vi.mock("@/components/VO2MaxFitnessCard", () => ({ VO2MaxFitnessCard: () => null }));
vi.mock("@/components/RacePredictorCard", () => ({ RacePredictorCard: () => null }));

beforeEach(() => {
  refreshMock.mockReset();
  useDashboardMock.mockReturnValue({
    stats: null,
    recent: [],
    loading: false,
    error: "activities.load_error",
    refresh: refreshMock,
  });
});

describe("HomePageClient dashboard failure", () => {
  it("shows a localized terminal error with retry instead of infinite loading", () => {
    render(<HomePageClient />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("activities.load_error");
    expect(screen.queryByText("home.loading_stats")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
