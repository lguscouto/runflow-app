import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  collectWebViewMetrics,
  normalizeCdpTargets,
  PAGE_METRICS_EXPRESSION,
  PERFORMANCE_OBSERVER_INSTALL_EXPRESSION,
  resolveWebViewPid,
} from "./webview-cdp.mjs";

describe("WebView CDP target trust boundary", () => {
  it("keeps only loopback ws targets on the same forwarded port", () => {
    const targets = normalizeCdpTargets(
      [
        { type: "page", webSocketDebuggerUrl: "wss://outside.example/devtools/page/1" },
        { type: "page", webSocketDebuggerUrl: "ws://outside.example/devtools/page/2" },
        { type: "page", webSocketDebuggerUrl: "ws://127.0.0.1:9333/devtools/page/3" },
        { type: "page", webSocketDebuggerUrl: "ws://localhost:9222/devtools/page/4" },
      ],
      "http://127.0.0.1:9222",
    );

    expect(targets).toEqual([
      { type: "page", webSocketDebuggerUrl: "ws://localhost:9222/devtools/page/4" },
    ]);
  });
});

describe("WebView CDP process selection", () => {
  it("fails closed when the requested PID belongs to the app process instead of the renderer", () => {
    const processes = [
      { pid: 401, name: "com.runflow.app", command: "com.runflow.app" },
      { pid: 402, name: "com.runflow.app:renderer", command: "com.runflow.app:renderer" },
    ];

    expect(() =>
      resolveWebViewPid({
        packageName: "com.runflow.app",
        pid: 401,
        processes,
      }),
    ).toThrow(/not a WebView renderer/i);
  });

  it("collects synthetic CDP metrics only after garbage collection", async () => {
    type CdpParams = { expression?: string; [key: string]: unknown };
    type CdpCall = { method: string; params: CdpParams };
    const calls: CdpCall[] = [];
    const session: {
      send: (method: string, params?: CdpParams) => Promise<Record<string, unknown>>;
    } = {
      async send(method: string, params: CdpParams = {}): Promise<Record<string, unknown>> {
        calls.push({ method, params });
        if (method === "Runtime.getHeapUsage") return { usedSize: 123456 };
        if (method === "Runtime.evaluate" && params.expression === "window") {
          return { result: { objectId: "window-object" } };
        }
        if (method === "Runtime.evaluate" && params.expression?.includes("querySelectorAll")) {
          return {
            result: {
              value: {
                domNodes: 321,
                lcpMs: 900,
                inpMs: 80,
                cls: 0.01,
                longTasks: { count: 1, maxMs: 55 },
              },
            },
          };
        }
        if (method === "DOMDebugger.getEventListeners") return { listeners: [{ type: "click" }] };
        return {};
      },
    };

    const result = await collectWebViewMetrics({
      packageName: "com.runflow.app",
      pid: 402,
      process: { pid: 402, name: "com.runflow.app:renderer" },
      session,
    });

    expect(calls[0].method).toBe("HeapProfiler.collectGarbage");
    expect(result.metrics.jsHeapUsedBytesAfterGc.value).toBe(123456);
    expect(result.metrics.domNodes.value).toBe(321);
    expect(result.metrics.eventListeners.value).toBe(1);
    expect(result.metrics.longTasks).toMatchObject({
      status: "collected",
      value: { maxMs: 55 },
    });
  });

  it("captures buffered WebView vitals when direct entries are empty after the page has loaded", async () => {
    type CdpParams = { expression?: string; [key: string]: unknown };
    type CdpCall = { method: string; params: CdpParams };
    const calls: CdpCall[] = [];
    let observerInstalled = false;
    let metricReads = 0;
    const session: {
      send: (method: string, params?: CdpParams) => Promise<Record<string, unknown>>;
    } = {
      async send(method: string, params: CdpParams = {}): Promise<Record<string, unknown>> {
        calls.push({ method, params });
        if (method === "Page.addScriptToEvaluateOnNewDocument") return { identifier: "observer-script" };
        if (method === "Runtime.getHeapUsage") return { usedSize: 123456 };
        if (method === "Runtime.evaluate" && params.expression === "window") {
          return { result: { objectId: "window-object" } };
        }
        if (method === "Runtime.evaluate") {
          const expression = String(params.expression ?? "");
          if (expression.includes("new PerformanceObserver") && expression.includes("buffered: true")) {
            observerInstalled = true;
            return { result: { value: { installed: true } } };
          }
          if (expression.includes("querySelectorAll")) {
            metricReads += 1;
            return {
              result: {
                value: {
                  domNodes: 321,
                  lcpMs: observerInstalled && metricReads >= 2 ? 900 : null,
                  inpMs: observerInstalled && metricReads >= 2 ? 80 : null,
                  cls: 0.01,
                  longTasks: { count: 1, maxMs: 55 },
                },
              },
            };
          }
        }
        if (method === "DOMDebugger.getEventListeners") return { listeners: [{ type: "click" }] };
        return {};
      },
    };

    const result = await collectWebViewMetrics({
      packageName: "com.runflow.app",
      pid: 402,
      process: { pid: 402, name: "com.runflow.app:renderer" },
      session,
      performancePollAttempts: 2,
      performancePollIntervalMs: 0,
    });

    const observerCallIndex = calls.findIndex(
      ({ method, params }) =>
        method === "Runtime.evaluate" &&
        params.expression?.includes("new PerformanceObserver") &&
        params.expression.includes("buffered: true"),
    );
    const newDocumentScriptCallIndex = calls.findIndex(
      ({ method }) => method === "Page.addScriptToEvaluateOnNewDocument",
    );
    const firstMetricCallIndex = calls.findIndex(
      ({ method, params }) => method === "Runtime.evaluate" && params.expression?.includes("querySelectorAll"),
    );

    expect(observerInstalled).toBe(true);
    expect(newDocumentScriptCallIndex).toBeGreaterThanOrEqual(0);
    expect(observerCallIndex).toBeGreaterThan(newDocumentScriptCallIndex);
    expect(firstMetricCallIndex).toBeGreaterThan(observerCallIndex);
    expect(metricReads).toBe(2);
    expect(result.metrics.lcpMs).toMatchObject({ status: "collected", value: 900 });
    expect(result.metrics.inpMs).toMatchObject({ status: "collected", value: 80 });
    expect(
      calls.some(({ method, params }) => method === "Runtime.evaluate" && params.expression?.includes("disconnect")),
    ).toBe(true);
    expect(calls.some(({ method }) => method === "Page.removeScriptToEvaluateOnNewDocument")).toBe(true);
  });

  it("marks CLS and Long Tasks not_executed when the WebView exposes no timeline entries", async () => {
    type CdpParams = { expression?: string; [key: string]: unknown };
    const session = {
      async send(method: string, params: CdpParams = {}): Promise<Record<string, unknown>> {
        if (method === "HeapProfiler.collectGarbage") return {};
        if (method === "Runtime.getHeapUsage") return { usedSize: 123456 };
        if (method === "Runtime.evaluate" && params.expression === "window") {
          return { result: { objectId: "window-object" } };
        }
        if (method === "Runtime.evaluate" && params.expression?.includes("new PerformanceObserver")) {
          return { result: { value: { installed: true } } };
        }
        if (method === "Runtime.evaluate" && params.expression?.includes("querySelectorAll")) {
          return {
            result: {
              value: {
                domNodes: 321,
                lcpMs: null,
                inpMs: null,
                cls: null,
                longTasks: null,
              },
            },
          };
        }
        if (method === "DOMDebugger.getEventListeners") return { listeners: [] };
        return {};
      },
    };

    const result = await collectWebViewMetrics({
      packageName: "com.runflow.app",
      pid: 402,
      process: { pid: 402, name: "com.runflow.app:renderer" },
      session,
      performancePollAttempts: 1,
      performancePollIntervalMs: 0,
    });

    expect(result.metrics.cls).toMatchObject({ status: "not_executed" });
    expect(result.metrics.cls).not.toHaveProperty("value");
    expect(result.metrics.longTasks).toMatchObject({ status: "not_executed" });
    expect(result.metrics.longTasks).not.toHaveProperty("value");
  });

  it("marks LCP and INP not_executed when the WebView exposes no legitimate entries", async () => {
    type CdpParams = { expression?: string; [key: string]: unknown };
    const session = {
      async send(method: string, params: CdpParams = {}): Promise<Record<string, unknown>> {
        if (method === "HeapProfiler.collectGarbage") return {};
        if (method === "Runtime.getHeapUsage") return { usedSize: 123456 };
        if (method === "Runtime.evaluate" && params.expression === "window") {
          return { result: { objectId: "window-object" } };
        }
        if (method === "Runtime.evaluate" && params.expression?.includes("new PerformanceObserver")) {
          return {
            result: {
              value: {
                installed: true,
                capabilities: {
                  "largest-contentful-paint": true,
                  event: true,
                  "layout-shift": true,
                  longtask: true,
                },
              },
            },
          };
        }
        if (method === "Runtime.evaluate" && params.expression?.includes("querySelectorAll")) {
          return {
            result: {
              value: {
                domNodes: 0,
                lcpMs: null,
                inpMs: null,
                cls: 0,
                longTasks: { count: 0, maxMs: 0 },
              },
            },
          };
        }
        if (method === "DOMDebugger.getEventListeners") return { listeners: [] };
        return {};
      },
    };

    const result = await collectWebViewMetrics({
      packageName: "com.runflow.app",
      pid: 402,
      process: { pid: 402, name: "com.runflow.app:renderer" },
      session,
      performancePollAttempts: 1,
      performancePollIntervalMs: 0,
    });

    expect(result.metrics.lcpMs).toMatchObject({ status: "not_executed" });
    expect(result.metrics.inpMs).toMatchObject({ status: "not_executed" });
    expect(result.metrics.lcpMs).not.toHaveProperty("value");
    expect(result.metrics.inpMs).not.toHaveProperty("value");
  });

  it("does not derive INP from malformed event entries", () => {
    const context = {
      performance: {
        getEntriesByType(type: string) {
          return type === "event"
            ? [
                { duration: 240, interactionId: 0 },
                { duration: 180 },
                { duration: 123, interactionId: Number.NaN },
                { interactionId: 1 },
                { duration: Number.NaN, interactionId: 2 },
                { duration: -1, interactionId: 3 },
              ]
            : [];
        },
      },
      document: { querySelectorAll: () => [] },
      __runflowWebViewPerformanceObservers__: { inpMs: null },
    };

    const result = runInNewContext(PAGE_METRICS_EXPRESSION, context) as { inpMs: unknown };

    expect(result.inpMs).toBeNull();
  });

  it("does not collect INP from observer entries without finite positive interaction data", () => {
    const observers: Array<{
      callback: (list: { getEntries: () => unknown[] }) => void;
      options?: { type?: string };
    }> = [];
    class FakePerformanceObserver {
      callback: (list: { getEntries: () => unknown[] }) => void;
      options?: { type?: string };

      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        this.callback = callback;
        observers.push(this);
      }

      observe(options: { type?: string }) {
        this.options = options;
      }

      disconnect() {}
    }

    const context = {
      PerformanceObserver: FakePerformanceObserver,
      __runflowWebViewPerformanceObservers__: undefined,
    };
    runInNewContext(
      `globalThis.top = globalThis; ${PERFORMANCE_OBSERVER_INSTALL_EXPRESSION}`,
      context,
    );

    const eventObserver = observers.find((observer) => observer.options?.type === "event");
    expect(eventObserver).toBeDefined();
    eventObserver?.callback({
      getEntries: () => [
        { interactionId: 0, duration: 240 },
        { duration: 180 },
        { interactionId: Number.NaN, duration: 123 },
        { interactionId: 1 },
        { interactionId: 2, duration: Number.NaN },
        { interactionId: 3, duration: -1 },
      ],
    });

    const result = runInNewContext(
      "globalThis.__runflowWebViewPerformanceObservers__",
      context,
    ) as { inpMs: unknown };
    expect(result.inpMs).toBeNull();
  });

  it("does not derive CLS or Long Tasks from malformed timeline entries", () => {
    const context = {
      performance: {
        getEntriesByType(type: string) {
          if (type === "layout-shift") {
            return [
              { hadRecentInput: false },
              { hadRecentInput: false, value: Number.NaN },
              { hadRecentInput: false, value: -1 },
            ];
          }
          if (type === "longtask") {
            return [{}, { duration: Number.NaN }, { duration: -1 }];
          }
          return [];
        },
      },
      document: { querySelectorAll: () => [] },
      __runflowWebViewPerformanceObservers__: { cls: null, longTasks: null },
    };

    const result = runInNewContext(PAGE_METRICS_EXPRESSION, context) as {
      cls: unknown;
      longTasks: unknown;
    };

    expect(result.cls).toBeNull();
    expect(result.longTasks).toBeNull();
  });

  it("does not collect CLS or Long Tasks from malformed observer entries", () => {
    const observers: Array<{
      callback: (list: { getEntries: () => unknown[] }) => void;
      options?: { type?: string };
    }> = [];
    class FakePerformanceObserver {
      callback: (list: { getEntries: () => unknown[] }) => void;
      options?: { type?: string };

      constructor(callback: (list: { getEntries: () => unknown[] }) => void) {
        this.callback = callback;
        observers.push(this);
      }

      observe(options: { type?: string }) {
        this.options = options;
      }

      disconnect() {}
    }

    const context = {
      PerformanceObserver: FakePerformanceObserver,
      __runflowWebViewPerformanceObservers__: undefined,
    };
    runInNewContext(
      `globalThis.top = globalThis; ${PERFORMANCE_OBSERVER_INSTALL_EXPRESSION}`,
      context,
    );

    for (const type of ["layout-shift", "longtask"]) {
      const observer = observers.find((candidate) => candidate.options?.type === type);
      expect(observer).toBeDefined();
      observer?.callback({
        getEntries: () =>
          type === "layout-shift"
            ? [{ hadRecentInput: false }, { hadRecentInput: false, value: Number.NaN }]
            : [{}, { duration: Number.NaN }, { duration: -1 }],
      });
    }

    const result = runInNewContext(
      "globalThis.__runflowWebViewPerformanceObservers__",
      context,
    ) as { cls: unknown; longTasks: unknown };
    expect(result.cls).toBeNull();
    expect(result.longTasks).toBeNull();
  });
});
