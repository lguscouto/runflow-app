/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackPoint } from "@/lib/types";

const { rendererInstances } = vi.hoisted(() => ({
  rendererInstances: [] as Array<{
    options: { antialias?: boolean };
    setSize: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");

  class TestWebGLRenderer {
    options: { antialias?: boolean };
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();

    constructor(options: { antialias?: boolean }) {
      this.options = options;
      rendererInstances.push(this);
    }
  }

  return { ...actual, WebGLRenderer: TestWebGLRenderer };
});

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

import { ActivityFlyover3D } from "./ActivityFlyover3D";

const points: TrackPoint[] = [
  {
    lat: -23.55,
    lng: -46.63,
    elevation: 700,
    timestamp: new Date("2026-01-01T10:00:00.000Z"),
  },
  {
    lat: -23.551,
    lng: -46.631,
    elevation: 705,
    timestamp: new Date("2026-01-01T10:00:05.000Z"),
  },
];
const densePoints: TrackPoint[] = Array.from({ length: 500 }, (_, index) => ({
  lat: -23.55 - index * 0.000001,
  lng: -46.63 - index * 0.000001,
  elevation: 700 + (index % 10),
  timestamp: new Date(2026, 0, 1, 10, 0, index),
}));

let nextAnimationFrameId = 1;
let pendingFrames = new Map<number, FrameRequestCallback>();
const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
  const id = nextAnimationFrameId++;
  pendingFrames.set(id, callback);
  return id;
});
const cancelAnimationFrameMock = vi.fn((id: number) => {
  pendingFrames.delete(id);
});

function runNextFrame(timestamp = 16) {
  const next = pendingFrames.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined;
  if (!next) throw new Error("No pending animation frame");
  pendingFrames.delete(next[0]);
  next[1](timestamp);
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: hidden,
  });
}

function setFullscreenElement(element: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    writable: true,
    value: element,
  });
}

describe("ActivityFlyover3D lifecycle and quality", () => {
  beforeEach(() => {
    rendererInstances.length = 0;
    nextAnimationFrameId = 1;
    pendingFrames = new Map();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);
    setDocumentHidden(false);
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      writable: true,
      value: null,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    pendingFrames.clear();
    vi.unstubAllGlobals();
  });

  it("keeps one RAF scheduled per cycle when visibility resumes repeatedly", () => {
    render(<ActivityFlyover3D points={points} />);

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(pendingFrames).toHaveLength(1);

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(pendingFrames).toHaveLength(1);

    runNextFrame();

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(pendingFrames).toHaveLength(1);
  });

  it("pauses and resumes playback without creating a second loop", () => {
    render(<ActivityFlyover3D points={points} />);

    runNextFrame();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(pendingFrames).toHaveLength(1);

    fireEvent.click(screen.getByTitle("Pausar"));
    fireEvent.click(screen.getByTitle("Reproduzir"));

    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(2);
    expect(pendingFrames).toHaveLength(1);

    runNextFrame();
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(3);
    expect(pendingFrames).toHaveLength(1);
  });

  it("disposes the renderer and cancels its frame exactly once", () => {
    const view = render(<ActivityFlyover3D points={points} />);
    const renderer = rendererInstances[0];

    expect(renderer).toBeDefined();
    view.unmount();
    view.unmount();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(1);
    expect(pendingFrames).toHaveLength(0);
  });

  it("keeps cleanup balanced across twenty mount and unmount cycles", () => {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const view = render(<ActivityFlyover3D points={points} />);
      view.unmount();
    }

    expect(rendererInstances).toHaveLength(20);
    expect(rendererInstances.every((renderer) => renderer.dispose.mock.calls.length === 1)).toBe(true);
    expect(rendererInstances.every((renderer) => renderer.forceContextLoss.mock.calls.length === 1)).toBe(true);
    expect(cancelAnimationFrameMock).toHaveBeenCalledTimes(20);
    expect(pendingFrames).toHaveLength(0);
  });

  it("updates fullscreen state only from the browser fullscreen event", () => {
    const view = render(<ActivityFlyover3D points={points} />);
    const container = view.container.firstElementChild as HTMLElement;
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const exitFullscreen = vi.fn(() => Promise.resolve());

    Object.defineProperty(container, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });

    fireEvent.click(screen.getByTitle("Tela cheia"));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(container.className).not.toContain("fixed");

    setFullscreenElement(container);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(container.className).toContain("fixed");

    fireEvent.click(screen.getByTitle("Tela cheia"));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(container.className).toContain("fixed");

    setFullscreenElement(null);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(container.className).not.toContain("fixed");
  });

  it("passes a measured balanced budget to the WebGL renderer", () => {
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const originalDeviceMemory = Object.getOwnPropertyDescriptor(navigator, "deviceMemory");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 1_200,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: 64,
    });

    try {
      render(<ActivityFlyover3D points={densePoints} />);

      const renderer = rendererInstances[0];
      expect(renderer.options.antialias).toBe(false);
      expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    } finally {
      if (originalWidth) {
        Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
      } else {
        delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
      }
      if (originalHeight) {
        Object.defineProperty(HTMLElement.prototype, "clientHeight", originalHeight);
      } else {
        delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight;
      }
      if (originalDeviceMemory) {
        Object.defineProperty(navigator, "deviceMemory", originalDeviceMemory);
      } else {
        delete (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      }
    }
  });
});
