import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildCdpForwardArgs,
  buildNotExecutedReport,
  buildPerfettoCommands,
  buildPerfettoGroup,
  collectorStatusFromMetrics,
  finishPerfettoTrace,
  parseAmStartOutput,
} from "./run-journey.mjs";

describe("performance journey runner", () => {
  it("parses only the explicit am start -W timing fields", () => {
    const result = parseAmStartOutput(
      ["Status: ok", "Activity: com.runflow.app/.MainActivity", "ThisTime: 91", "TotalTime: 103", "WaitTime: 12"].join(
        "\n",
      ),
    );

    expect(result).toEqual({ totalTimeMs: 103, thisTimeMs: 91, waitTimeMs: 12 });
  });

  it("accepts Android 37 am start -W output when ThisTime is omitted", () => {
    const result = parseAmStartOutput(
      [
        "Status: ok",
        "LaunchState: COLD",
        "Activity: com.runflow.app/.MainActivity",
        "TotalTime: 2236",
        "WaitTime: 2239",
        "Complete",
      ].join("\n"),
    );

    expect(result).toEqual({ totalTimeMs: 2236, thisTimeMs: null, waitTimeMs: 2239 });
  });

  it("uses the app PID for the WebView CDP socket, not the isolated renderer PID", async () => {
    const { buildCdpForwardArgs } = await import("./run-journey.mjs");

    expect(buildCdpForwardArgs({ port: 9222, appPid: 19693 })).toEqual([
      "forward",
      "tcp:9222",
      "localabstract:webview_devtools_remote_19693",
    ]);
  });

  it("pipes the Perfetto config and writes the trace to the Android trace directory", () => {
    expect(
      buildPerfettoCommands({
        configPath: "scripts/perf/perfetto-config.pbtxt",
        remoteConfig: "/data/local/tmp/runflow-config.pbtxt",
        remoteTrace: "/data/misc/perfetto-traces/runflow-trace.pftrace",
        outputPath: "C:/Temp/runflow-trace.pftrace",
      }),
    ).toEqual([
      ["push", "scripts/perf/perfetto-config.pbtxt", "/data/local/tmp/runflow-config.pbtxt"],
      [
        "shell",
        "cat /data/local/tmp/runflow-config.pbtxt | perfetto --txt -c - -o /data/misc/perfetto-traces/runflow-trace.pftrace --background-wait",
      ],
      ["pull", "/data/misc/perfetto-traces/runflow-trace.pftrace", "C:/Temp/runflow-trace.pftrace"],
    ]);
  });

  it("keeps the Perfetto trace at the analyzer's metric path", () => {
    const trace = { status: "not_executed", reason: "synthetic omission" };
    expect(buildPerfettoGroup(trace)).toEqual({ trace });
  });

  it("starts the Perfetto session before startup measurement", () => {
    const source = readFileSync(resolve(process.cwd(), "scripts/perf/run-journey.mjs"), "utf8");
    expect(source).toContain("const perfettoSession = options.perfettoConfig");
    expect(source.indexOf("const perfettoSession = options.perfettoConfig")).toBeLessThan(
      source.indexOf('const startOutput = runAdb(["shell", "am", "start"'),
    );
  });

  it("marks the CDP collector not executed when a required WebView metric is unavailable", () => {
    expect(
      collectorStatusFromMetrics({
        lcpMs: { status: "not_executed", reason: "WebView did not expose LCP" },
        inpMs: { status: "not_executed", reason: "WebView did not expose INP" },
      }),
    ).toBe("not_executed");
    expect(
      collectorStatusFromMetrics({
        lcpMs: { status: "collected", value: 900 },
        inpMs: { status: "collected", value: 80 },
      }),
    ).toBe("collected");
  });

  it("waits for the remote trace to flush after Perfetto exits before pulling it", async () => {
    const root = mkdtempSync(join(tmpdir(), "runflow-perfetto-test-"));
    const outputPath = join(root, "trace.pftrace");
    let aliveChecks = 0;
    let sizeChecks = 0;
    const runAdb = (args: string[]): string => {
      if (args[0] === "shell" && args[1] === "kill") {
        aliveChecks += 1;
        if (aliveChecks === 1) return "";
        throw new Error("Perfetto process exited");
      }
      if (args[0] === "shell" && args[1] === "stat") {
        sizeChecks += 1;
        return sizeChecks === 1 ? "0" : "4096";
      }
      if (args[0] === "pull") {
        writeFileSync(outputPath, Buffer.alloc(4096));
        return "";
      }
      if (args[0] === "shell" && args[1] === "rm") return "";
      throw new Error(`unexpected adb command: ${args.join(" ")}`);
    };

    try {
      const result = await finishPerfettoTrace({
        runAdb,
        session: {
          pid: 123,
          remoteConfig: "/data/local/tmp/runflow-test.pbtxt",
          remoteTrace: "/data/misc/perfetto-traces/runflow-test.pftrace",
          outputPath,
        },
        timeoutMs: 1_000,
        pollIntervalMs: 0,
      });

      expect(result.status).toBe("collected");
      expect(sizeChecks).toBeGreaterThan(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an empty local trace after adb pull", async () => {
    const root = mkdtempSync(join(tmpdir(), "runflow-perfetto-empty-"));
    const outputPath = join(root, "trace.pftrace");
    const runAdb = (args: string[]): string => {
      if (args[0] === "shell" && args[1] === "kill") throw new Error("Perfetto process exited");
      if (args[0] === "shell" && args[1] === "stat") return "4096";
      if (args[0] === "pull") {
        writeFileSync(outputPath, Buffer.alloc(0));
        return "";
      }
      if (args[0] === "shell" && args[1] === "rm") return "";
      throw new Error(`unexpected adb command: ${args.join(" ")}`);
    };

    try {
      await expect(
        finishPerfettoTrace({
          runAdb,
          session: {
            pid: 123,
            remoteConfig: "/data/local/tmp/runflow-test.pbtxt",
            remoteTrace: "/data/misc/perfetto-traces/runflow-test.pftrace",
            outputPath,
          },
          timeoutMs: 1_000,
          pollIntervalMs: 0,
        }),
      ).rejects.toThrow(/empty|zero/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("marks a dry run as not executed instead of inventing metrics", () => {
    const report = buildNotExecutedReport({
      journeyId: "synthetic-startup",
      packageName: "com.runflow.app",
      activity: "com.runflow.app/.MainActivity",
      expectedRuns: 1,
      reason: "dry run",
    });

    expect(report.status).toBe("not_executed");
    expect(report.runs).toHaveLength(0);
    expect(report.collectors).toEqual({ adb: "not_executed", cdp: "not_executed", perfetto: "not_executed" });
    expect(JSON.stringify(report)).not.toContain("TotalTime");
  });
});
