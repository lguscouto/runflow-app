/** @vitest-environment jsdom */
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalHeatmap } from "./PersonalHeatmap";
import type { HeatmapTrack } from "@/lib/heatmap-data";

const {
  getAllStoredActivitiesMock,
  getAllStoredRoutesMock,
  forEachHeatmapBatchMock,
} = vi.hoisted(() => ({
  getAllStoredActivitiesMock: vi.fn(),
  getAllStoredRoutesMock: vi.fn(),
  forEachHeatmapBatchMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getAllStoredActivities: getAllStoredActivitiesMock,
  getAllStoredRoutes: getAllStoredRoutesMock,
}));

vi.mock("@/lib/heatmap-data", () => ({
  forEachHeatmapBatch: forEachHeatmapBatchMock,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ language: "pt", t: (key: string) => key }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/components/PrivacyAwareTileLayer", () => ({
  PrivacyAwareTileLayer: () => null,
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-testid": "map" }, children),
  TileLayer: () => null,
  Polyline: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  Popup: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock("leaflet/dist/leaflet.css", () => ({}));

const sampleTrack: HeatmapTrack = {
  id: "heat-1",
  name: "Treino sintético",
  sport: "running",
  startedAt: "2026-08-24T12:00:00.000Z",
  distanceM: 5000,
  durationSec: 1800,
  avgPaceSecKm: 360,
  points: [
    [-23.5, -46.6],
    [-23.51, -46.61],
  ],
};

describe("PersonalHeatmap incremental loading", () => {
  beforeEach(() => {
    getAllStoredActivitiesMock.mockReset();
    getAllStoredRoutesMock.mockReset().mockResolvedValue([]);
    forEachHeatmapBatchMock.mockReset();
  });

  it("consumes simplified batches without loading full StoredActivity records", async () => {
    getAllStoredActivitiesMock.mockImplementation(() => {
      throw new Error("getAllStoredActivities must not be called");
    });
    forEachHeatmapBatchMock.mockImplementation(async (_options, consume) => {
      await consume([sampleTrack]);
      return { activities: 1, renderedPoints: 2 };
    });

    render(<PersonalHeatmap />);

    await waitFor(() => expect(screen.getByTestId("map")).toBeTruthy());
    expect(forEachHeatmapBatchMock).toHaveBeenCalledTimes(1);
    expect(getAllStoredActivitiesMock).not.toHaveBeenCalled();
    expect(screen.getByText(/1 treinos/)).toBeTruthy();
  });

  it("passes sport metadata filters to the stream instead of loading unrelated tracks", async () => {
    const optionsSeen: Array<{ filter?: (summary: { sport: string; startedAt: string }) => boolean }> = [];
    forEachHeatmapBatchMock.mockImplementation(async (options, consume) => {
      optionsSeen.push(options);
      const runningSummary = {
        sport: "running",
        startedAt: "2026-08-24T12:00:00.000Z",
      };
      if (!options.filter || options.filter(runningSummary)) {
        await consume([sampleTrack]);
      }
      return { activities: 1, renderedPoints: 2 };
    });

    render(<PersonalHeatmap />);
    await waitFor(() => expect(forEachHeatmapBatchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /sport\.cycling/ }));
    await waitFor(() => expect(forEachHeatmapBatchMock).toHaveBeenCalledTimes(2));

    const cyclingFilter = optionsSeen[1].filter;
    expect(cyclingFilter).toBeDefined();
    expect(cyclingFilter?.({ sport: "cycling", startedAt: "2026-08-24T12:00:00.000Z" })).toBe(true);
    expect(cyclingFilter?.({ sport: "running", startedAt: "2026-08-24T12:00:00.000Z" })).toBe(false);
  });

  it("keeps every available year selectable after filtering one year", async () => {
    const olderTrack: HeatmapTrack = {
      ...sampleTrack,
      id: "heat-older",
      startedAt: "2025-08-24T12:00:00.000Z",
    };

    forEachHeatmapBatchMock.mockImplementation(async (options, consume) => {
      const candidates = [sampleTrack, olderTrack];
      const matchingTracks = candidates.filter((track) =>
        options.filter?.({ sport: track.sport, startedAt: track.startedAt }) ?? true,
      );
      if (matchingTracks.length > 0) await consume(matchingTracks);
      return {
        activities: candidates.length,
        renderedPoints: matchingTracks.reduce((total, track) => total + track.points.length, 0),
        availableYears: ["2026", "2025"],
      };
    });

    render(<PersonalHeatmap />);
    await waitFor(() => expect(forEachHeatmapBatchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTitle("Ajustes do Mapa de Calor"));
    const yearSelect = screen.getAllByRole("combobox")[1];
    expect(screen.getByRole("option", { name: "2025" })).toBeTruthy();

    fireEvent.change(yearSelect, { target: { value: "2026" } });
    await waitFor(() => expect(forEachHeatmapBatchMock).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("option", { name: "2025" })).toBeTruthy();
  });

  it("aborts the active stream when unmounted", async () => {
    let receivedSignal: AbortSignal | undefined;
    let resolveStream!: (value: { activities: number; renderedPoints: number }) => void;
    forEachHeatmapBatchMock.mockImplementation((options) => {
      receivedSignal = options.signal;
      return new Promise((resolve) => {
        resolveStream = resolve;
      });
    });

    const { unmount } = render(<PersonalHeatmap />);
    await waitFor(() => expect(receivedSignal).toBeDefined());
    unmount();
    expect(receivedSignal?.aborted).toBe(true);
    resolveStream({ activities: 0, renderedPoints: 0 });
  });
});
