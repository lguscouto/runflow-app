import { describe, expect, it } from "vitest";
import { analyzeResults } from "./analyze-results.mjs";

type SyntheticMetric =
  | {
      status: "collected";
      value: unknown;
      unit: string;
      source: string;
    }
  | {
      status: "not_executed";
      reason: string;
    };

type SyntheticRun = {
  id: string;
  status: "collected";
  startup: Record<string, SyntheticMetric>;
  android: Record<string, SyntheticMetric>;
  webview: Record<string, SyntheticMetric>;
  perfetto: Record<string, SyntheticMetric>;
};

type SyntheticDocument = {
  schemaVersion: 1;
  status: "collected" | "not_executed";
  journey: { id: string };
  expectedRuns: number;
  runs: SyntheticRun[];
  collectors: {
    adb: "collected" | "not_executed";
    cdp: "collected" | "not_executed";
    perfetto: "collected" | "not_executed";
  };
};

const metric = (value: unknown, unit = "synthetic"): SyntheticMetric => ({
  status: "collected",
  value,
  unit,
  source: "synthetic-test",
});

function completeRun(index: number): SyntheticRun {
  return {
    id: `run-${index}`,
    status: "collected",
    startup: {
      totalTimeMs: metric(100 + index, "ms"),
      thisTimeMs: metric(90 + index, "ms"),
      waitTimeMs: metric(10, "ms"),
    },
    android: {
      appPssKb: metric(12000 + index, "KiB"),
      appPrivateDirtyKb: metric(5000 + index, "KiB"),
      appGraphicsKb: metric(700, "KiB"),
      webviewPssKb: metric(3000 + index, "KiB"),
      gfxinfo: metric(
        {
          totalFrames: 100,
          jankyFrames: 1,
          jankPercent: 1,
          frameTimePercentilesMs: { p50: 16, p90: 20, p95: 24, p99: 30 },
        },
        "frames",
      ),
      frameTimeline: metric({ frameCount: 100 }, "frames"),
      exitInfo: metric({ records: 0 }, "records"),
      logcat: metric({ lines: 3, fatalExceptions: 0, anrs: 0 }, "summary"),
    },
    webview: {
      jsHeapUsedBytesAfterGc: metric(500000 + index, "bytes"),
      domNodes: metric(120, "nodes"),
      eventListeners: metric(14, "listeners"),
      lcpMs: metric(900 + index, "ms"),
      inpMs: metric(80 + index, "ms"),
      cls: metric(0.02, "score"),
      longTasks: metric({ count: 1, maxMs: 55 }, "tasks"),
    },
    perfetto: {
      trace: metric({ path: `synthetic-trace-${index}.pftrace`, bytes: 1024 }, "trace"),
    },
  };
}

function completeDocument(
  { expectedRuns = 2, runCount }: { expectedRuns?: number; runCount?: number } = {},
): SyntheticDocument {
  const actualRunCount = runCount ?? expectedRuns;
  return {
    schemaVersion: 1,
    status: "collected",
    journey: { id: "synthetic-startup" },
    expectedRuns,
    runs: Array.from({ length: actualRunCount }, (_, index) => completeRun(index + 1)),
    collectors: { adb: "collected", cdp: "collected", perfetto: "collected" },
  };
}

describe("performance result analysis", () => {
  it("returns percentile summaries for a complete synthetic result", () => {
    const report = analyzeResults(completeDocument());

    expect(report.status).toBe("verified");
    expect(report.sampleCount).toBe(2);
    expect(report.metrics["startup.totalTimeMs"]).toMatchObject({
      count: 2,
      p50: 101,
      p95: 102,
      p99: 102,
    });
  });

  it("fails closed when the collection status is absent", () => {
    const document = completeDocument();
    delete (document as Partial<SyntheticDocument>).status;

    expect(() => analyzeResults(document)).toThrow(/performance results status is required/i);
  });

  it("fails closed when the collector status block is absent", () => {
    const document = completeDocument();
    delete (document as Partial<SyntheticDocument>).collectors;

    expect(() => analyzeResults(document)).toThrow(/performance results collectors are required/i);
  });

  it("fails closed when a collector is explicitly not executed", () => {
    const document = completeDocument();
    document.collectors.perfetto = "not_executed";

    expect(() => analyzeResults(document)).toThrow(/incomplete analysis.*collector perfetto.*not_executed/i);
  });

  it("fails closed when a required metric is absent", () => {
    const document = completeDocument();
    const { inpMs: _missing, ...webviewWithoutInpMs } = document.runs[0].webview;
    document.runs[0].webview = webviewWithoutInpMs;

    expect(() => analyzeResults(document)).toThrow(/missing metric: webview\.inpMs/i);
  });

  it("fails closed when fewer runs than requested are present", () => {
    const document = completeDocument({ expectedRuns: 2, runCount: 1 });

    expect(() => analyzeResults(document)).toThrow(/expected 2 runs, observed 1/i);
  });

  it("fails closed when a complete-looking document is marked not executed", () => {
    const document = completeDocument();
    document.status = "not_executed";

    expect(() => analyzeResults(document)).toThrow(/incomplete analysis.*status.*not_executed/i);
  });

  it("fails closed when the Perfetto trace is not collected", () => {
    const document = completeDocument();
    document.runs[0].perfetto.trace = { status: "not_executed", reason: "synthetic omission" };

    expect(() => analyzeResults(document)).toThrow(/metric not collected: perfetto\.trace/i);
  });

  it("fails closed when a collected Perfetto trace has no evidence path", () => {
    const document = completeDocument();
    document.runs[0].perfetto.trace = metric({}, "trace");

    expect(() => analyzeResults(document)).toThrow(/invalid trace metric: perfetto\.trace/i);
  });

  it("fails closed when Perfetto evidence reports zero bytes", () => {
    const document = completeDocument();
    document.runs[0].perfetto.trace = metric(
      { path: "synthetic-trace-1.pftrace", bytes: 0 },
      "trace",
    );

    expect(() => analyzeResults(document)).toThrow(/invalid trace metric: perfetto\.trace/i);
  });

  it("fails closed for malformed collected structured metrics", () => {
    const cases = [
      ["android", "gfxinfo"],
      ["android", "frameTimeline"],
      ["android", "exitInfo"],
      ["android", "logcat"],
      ["webview", "longTasks"],
    ] as const;

    for (const [section, key] of cases) {
      const document = completeDocument();
      document.runs[0][section][key] = metric({});

      expect(() => analyzeResults(document), `${section}.${key}`).toThrow(
        new RegExp(`invalid structured metric: ${section}\\.${key}`),
      );
    }
  });

  it("fails closed when collected metrics omit provenance", () => {
    const document = completeDocument();
    const metricWithoutUnit = document.runs[0].webview.domNodes as Record<string, unknown>;
    delete metricWithoutUnit.unit;

    expect(() => analyzeResults(document)).toThrow(/missing metric provenance: webview\.domNodes/i);

    const secondDocument = completeDocument();
    const metricWithoutSource = secondDocument.runs[0].webview.domNodes as Record<string, unknown>;
    delete metricWithoutSource.source;

    expect(() => analyzeResults(secondDocument)).toThrow(/missing metric provenance: webview\.domNodes/i);
  });

  it("fails closed for impossible numeric and structured metric domains", () => {
    const numericDocument = completeDocument();
    numericDocument.runs[0].webview.domNodes = metric(-1, "nodes");
    expect(() => analyzeResults(numericDocument)).toThrow(/invalid numeric metric: webview\.domNodes/i);

    const gfxinfoDocument = completeDocument();
    gfxinfoDocument.runs[0].android.gfxinfo = metric(
      {
        totalFrames: 10,
        jankyFrames: 11,
        jankPercent: 110,
        frameTimePercentilesMs: {},
      },
      "frames",
    );
    expect(() => analyzeResults(gfxinfoDocument)).toThrow(/invalid structured metric: android\.gfxinfo/i);

    const longTaskDocument = completeDocument();
    longTaskDocument.runs[0].webview.longTasks = metric({ count: 1, maxMs: 0 }, "tasks");
    expect(() => analyzeResults(longTaskDocument)).toThrow(/invalid structured metric: webview\.longTasks/i);
  });

  it("keeps optional Android ThisTime absence as an explicit limitation", () => {
    const document = completeDocument();
    for (const run of document.runs) {
      run.startup.thisTimeMs = { status: "not_executed", reason: "Android omitted ThisTime" };
    }

    const report = analyzeResults(document);

    expect(report.status).toBe("verified");
    expect(report.metrics["startup.thisTimeMs"]).toEqual({
      status: "not_executed",
      reason: "Android omitted ThisTime",
    });
    expect(report.limitations).toContain("startup.thisTimeMs: Android omitted ThisTime");
  });

  it("accepts an omitted optional ThisTime field without deriving a value", () => {
    const document = completeDocument();
    for (const run of document.runs) {
      delete run.startup.thisTimeMs;
    }

    const report = analyzeResults(document);

    expect(report.metrics["startup.thisTimeMs"]).toMatchObject({ status: "not_executed" });
    expect(report.metrics["startup.thisTimeMs"]).not.toHaveProperty("p50");
    expect(report.limitations[0]).toMatch(/startup\.thisTimeMs:/i);
  });
});
