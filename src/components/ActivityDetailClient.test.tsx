/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityDetailClient } from "./ActivityDetailClient";

const { useActivityDetailMock, refreshMock } = vi.hoisted(() => ({
  useActivityDetailMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=activity-1"),
}));
vi.mock("@/hooks/useActivities", () => ({ useActivityDetail: useActivityDetailMock }));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, language: "en" }),
}));
vi.mock("@/lib/storage", () => ({
  getAllStoredGear: vi.fn(() => new Promise(() => {})),
  getAllStoredSummaries: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/profile", () => ({ getUserProfile: vi.fn().mockResolvedValue(null) }));

beforeEach(() => {
  refreshMock.mockReset();
  useActivityDetailMock.mockReturnValue({
    activity: null,
    loading: false,
    notFound: false,
    error: "activities.load_error",
    refresh: refreshMock,
  });
});

describe("ActivityDetailClient storage failure", () => {
  it("shows a localized terminal error with retry instead of infinite loading", () => {
    render(<ActivityDetailClient />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("activities.load_error");
    expect(screen.queryByText("detail.loading")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
