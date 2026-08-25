/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityList } from "./ActivityList";
import { makeStoredActivity } from "../../tests/fixtures/activityFactory";
import { toActivitySummary } from "@/lib/storage";

const { virtualizerOptionsMock } = vi.hoisted(() => ({
  virtualizerOptionsMock: vi.fn(),
}));

vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...actual,
    useWindowVirtualizer: (options: Parameters<typeof actual.useWindowVirtualizer>[0]) => {
      virtualizerOptionsMock(options);
      return actual.useWindowVirtualizer(options);
    },
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    language: "pt-BR",
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/haptics", () => ({
  haptics: { light: vi.fn() },
}));

const activities = Array.from({ length: 1000 }, (_, index) =>
  toActivitySummary(
    makeStoredActivity({
      id: `virtual-${index}`,
      name:
        index % 2 === 0
          ? `Treino curto ${index}`
          : `Treino longo ${index} ${"com descrição extensa ".repeat(8)}`,
    }),
  ),
);

describe("ActivityList variable-height virtualization", () => {
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    virtualizerOptionsMock.mockClear();
    HTMLElement.prototype.getBoundingClientRect = function () {
      const height =
        this.tagName === "A" && this.textContent?.includes("Treino longo")
          ? 140
          : this.tagName === "A"
            ? 74
            : 0;
      const isListContainer =
        this.tagName === "DIV" && this.classList.contains("overflow-hidden");
      const top = isListContainer ? 1200 - window.scrollY : 0;
      return {
        x: 0,
        y: top,
        width: 320,
        height,
        top,
        right: 320,
        bottom: top + height,
        left: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 640,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0);
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.unstubAllGlobals();
  });

  it("keeps a bounded DOM and reveals the final activity after window scrolling", async () => {
    render(<ActivityList activities={activities} />);

    await waitFor(() => {
      expect(document.querySelectorAll('a[href^="/atividades/ver/"]').length).toBeLessThan(100);
    });
    expect(screen.queryByText(/Treino curto 998/)).toBeNull();

    await act(async () => {
      window.scrollY = 100000;
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.setTimeout(resolve, 30));
    });
    expect(await screen.findByText(/Treino curto 998/)).toBeTruthy();
  });

  it("keeps the first row visible when the list starts below the window scroll offset", async () => {
    window.scrollY = 1200;
    render(<ActivityList activities={activities} />);

    expect(await screen.findByText(/Treino curto 0/)).toBeTruthy();
    await waitFor(() => {
      const lastOptions = virtualizerOptionsMock.mock.calls.at(-1)?.[0];
      expect(lastOptions?.scrollMargin).toBe(1200);
    });
  });

  it("calculates the window offset when an initially empty list receives activities", async () => {
    window.scrollY = 1200;
    const { rerender } = render(<ActivityList activities={[]} />);

    rerender(<ActivityList activities={activities} />);

    await waitFor(() => {
      const lastOptions = virtualizerOptionsMock.mock.calls.at(-1)?.[0];
      expect(lastOptions?.scrollMargin).toBe(1200);
    });
  });

  it("requests exactly one page for one sentinel intersection", async () => {
    const onLoadMore = vi.fn();
    const observerState: {
      callback: IntersectionObserverCallback | null;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    } = {
      callback: null,
      observe: vi.fn(),
      disconnect: vi.fn(),
    };
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (callback: IntersectionObserverCallback) {
        observerState.callback = callback;
        return observerState;
      }),
    );

    render(
      <ActivityList
        activities={activities.slice(0, 3)}
        hasMore
        loadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );

    await waitFor(() => expect(observerState.observe).toHaveBeenCalledTimes(1));
    act(() => {
      observerState.callback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observerState as unknown as IntersectionObserver,
      );
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("exposes a retry action when page loading fails", () => {
    const onRetry = vi.fn();
    render(
      <ActivityList
        activities={activities.slice(0, 3)}
        hasMore
        error="Falha temporária"
        onRetry={onRetry}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Falha temporária");
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
