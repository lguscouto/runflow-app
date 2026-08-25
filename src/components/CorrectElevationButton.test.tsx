// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enrich: vi.fn(),
}));

vi.mock("@/lib/enrichment", () => ({
  enrichActivityElevationWithRetry: mocks.enrich,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { CorrectElevationButton } from "./CorrectElevationButton";
import { hasElevationConsent } from "@/lib/external-privacy";

describe("CorrectElevationButton privacy consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.enrich.mockImplementation(() => new Promise(() => {}));
  });

  it("does not send activity coordinates when the user declines the Open-Meteo disclosure", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CorrectElevationButton activityId="activity-1" />);

    fireEvent.click(screen.getByRole("button", { name: "detail.correct_elevation_btn" }));

    expect(confirm).toHaveBeenCalledWith("detail.correct_elevation_consent");
    expect(mocks.enrich).not.toHaveBeenCalled();
  });

  it("records consent before invoking the elevation client", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CorrectElevationButton activityId="activity-1" />);

    fireEvent.click(screen.getByRole("button", { name: "detail.correct_elevation_btn" }));

    expect(hasElevationConsent()).toBe(true);
    expect(mocks.enrich).toHaveBeenCalledWith("activity-1", expect.any(Function));
  });
});
