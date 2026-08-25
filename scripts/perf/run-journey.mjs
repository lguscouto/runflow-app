import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectAndroidProcessMetrics, collectedMetric } from "./android-processes.mjs";
import { collectWebViewMetricsFromEndpoint } from "./webview-cdp.mjs";

const PACKAGE_PATTERN = /^[A-Za-z][A-Za-z0-9_.]*$/;
const COMPONENT_PATTERN = /^[A-Za-z][A-Za-z0-9_.$]*\/[A-Za-z0-9_.$]+$/;
const JOURNEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function notExecutedMetric(reason) {
  return { status: "not_executed", reason };
}

function notExecutedGroup(names, reason) {
  return Object.fromEntries(names.map((name) => [name, notExecutedMetric(reason)]));
}

export function buildPerfettoGroup(traceMetric) {
  return { trace: traceMetric };
}

export function collectorStatusFromMetrics(metrics) {
  if (metrics === null || typeof metrics !== "object" || Array.isArray(metrics)) return "not_executed";
  return Object.values(metrics).every((metric) => metric?.status === "collected") ? "collected" : "not_executed";
}

export function buildCdpForwardArgs({ port, appPid }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CDP port is invalid");
  if (!Number.isInteger(Number(appPid)) || Number(appPid) <= 0) throw new Error("app PID is invalid");
  return ["forward", `tcp:${port}`, `localabstract:webview_devtools_remote_${Number(appPid)}`];
}

function validatePackageName(packageName) {
  if (typeof packageName !== "string" || !PACKAGE_PATTERN.test(packageName)) {
    throw new Error("package name is invalid");
  }
  return packageName;
}

function validateActivity(activity) {
  if (typeof activity !== "string" || !COMPONENT_PATTERN.test(activity) || !activity.includes("/")) {
    throw new Error("activity must be an Android component");
  }
  return activity;
}

function validateJourneyId(journeyId) {
  if (typeof journeyId !== "string" || !JOURNEY_PATTERN.test(journeyId)) {
    throw new Error("journey id is invalid");
  }
  return journeyId;
}

function positiveInteger(value, label, maximum = 1000) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > maximum) {
    throw new Error(`${label} must be a positive integer no greater than ${maximum}`);
  }
  return number;
}

export function parseAmStartOutput(output) {
  const values = {};
  for (const line of String(output ?? "").replaceAll("\r", "").split("\n")) {
    const match = line.match(/^\s*(TotalTime|ThisTime|WaitTime):\s*(\d+)\s*$/i);
    if (match) values[match[1].toLowerCase()] = Number(match[2]);
  }
  for (const [key, label] of [
    ["totaltime", "totalTimeMs"],
    ["waittime", "waitTimeMs"],
  ]) {
    if (!Number.isFinite(values[key])) throw new Error(`missing startup metric: ${label}`);
  }
  return {
    totalTimeMs: values.totaltime,
    thisTimeMs: Number.isFinite(values.thistime) ? values.thistime : null,
    waitTimeMs: values.waittime,
  };
}

export function buildNotExecutedReport({ journeyId, packageName, activity, expectedRuns, reason }) {
  return {
    schemaVersion: 1,
    status: "not_executed",
    journey: {
      id: validateJourneyId(journeyId),
      packageName: validatePackageName(packageName),
      activity: validateActivity(activity),
    },
    expectedRuns: positiveInteger(expectedRuns, "expectedRuns"),
    runs: [],
    collectors: { adb: "not_executed", cdp: "not_executed", perfetto: "not_executed" },
    reason: String(reason || "collection was not executed"),
  };
}

function commandFailure(error) {
  const stderr = error?.stderr ? String(error.stderr).trim() : "";
  const stdout = error?.stdout ? String(error.stdout).trim() : "";
  return new Error(stderr || stdout || "ADB command failed");
}

export function createAdbRunner({ adbPath = "adb", serial }) {
  if (typeof adbPath !== "string" || adbPath.trim() === "") throw new Error("adbPath is required");
  return (args) => {
    const command = serial ? ["-s", serial, ...args] : args;
    try {
      return String(
        execFileSync(adbPath, command, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        }),
      ).replaceAll("\r", "");
    } catch (error) {
      throw commandFailure(error);
    }
  };
}

function buildStartupMetrics(startup) {
  return {
    totalTimeMs: collectedMetric(startup.totalTimeMs, "ms", "adb.am.start.-W"),
    thisTimeMs:
      startup.thisTimeMs === null
        ? notExecutedMetric("Android am start -W omitted ThisTime")
        : collectedMetric(startup.thisTimeMs, "ms", "adb.am.start.-W"),
    waitTimeMs: collectedMetric(startup.waitTimeMs, "ms", "adb.am.start.-W"),
  };
}

function parsePort(endpoint) {
  try {
    const url = new URL(endpoint);
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
  } catch {
    return null;
  }
}

function outputPathForRun(basePath, runIndex) {
  if (!basePath) return null;
  const extension = path.extname(basePath) || ".pftrace";
  const stem = basePath.slice(0, basePath.length - path.extname(basePath).length);
  return path.resolve(`${stem}-${runIndex}${extension}`);
}

export function buildPerfettoCommands({ configPath, remoteConfig, remoteTrace, outputPath }) {
  return [
    ["push", configPath, remoteConfig],
    ["shell", `cat ${remoteConfig} | perfetto --txt -c - -o ${remoteTrace} --background-wait`],
    ["pull", remoteTrace, outputPath],
  ];
}

function parsePerfettoBackgroundPid(output) {
  const pid = String(output ?? "")
    .trim()
    .split(/\s+/)
    .reverse()
    .find((token) => /^\d+$/.test(token));
  if (!pid || Number(pid) <= 0) throw new Error("Perfetto background PID was not returned");
  return Number(pid);
}

function cleanupPerfettoTrace({ runAdb, session, terminate = false }) {
  if (terminate) {
    try {
      runAdb(["shell", "kill", "-TERM", String(session.pid)]);
    } catch {
      // The tracing process may already have finished.
    }
  }
  try {
    runAdb(["shell", "rm", "-f", session.remoteConfig, session.remoteTrace]);
  } catch {
    // Cleanup failure must not hide the collection error.
  }
}

export function startPerfettoTrace({ runAdb, configPath, outputPath, runIndex }) {
  if (typeof runAdb !== "function") throw new Error("runAdb is required for Perfetto");
  if (!configPath || !fs.existsSync(configPath)) throw new Error("Perfetto config file is missing");
  if (!outputPath) throw new Error("Perfetto output path is required");
  const remoteConfig = `/data/local/tmp/runflow-perfetto-${process.pid}.pbtxt`;
  const remoteTrace = `/data/misc/perfetto-traces/runflow-perfetto-${process.pid}-${runIndex}.pftrace`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.rmSync(outputPath, { force: true });
  const [pushCommand, startCommand] = buildPerfettoCommands({
    configPath,
    remoteConfig,
    remoteTrace,
    outputPath,
  });
  runAdb(pushCommand);
  try {
    const pid = parsePerfettoBackgroundPid(runAdb(startCommand));
    return { pid, remoteConfig, remoteTrace, outputPath };
  } catch (error) {
    cleanupPerfettoTrace({ runAdb, session: { pid: null, remoteConfig, remoteTrace }, terminate: false });
    throw error;
  }
}

export async function finishPerfettoTrace({
  runAdb,
  session,
  timeoutMs = 30_000,
  pollIntervalMs = 250,
}) {
  const deadline = Date.now() + timeoutMs;
  const interval = Math.max(0, Number(pollIntervalMs) || 0);
  try {
    while (true) {
      let alive = false;
      try {
        runAdb(["shell", "kill", "-0", String(session.pid)]);
        alive = true;
      } catch {
        alive = false;
      }
      if (!alive) break;
      if (Date.now() >= deadline) {
        cleanupPerfettoTrace({ runAdb, session, terminate: true });
        throw new Error(`Perfetto trace did not finish within ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    let remoteBytes = 0;
    while (remoteBytes <= 0) {
      try {
        const statOutput = runAdb(["shell", "stat", "-c", "%s", session.remoteTrace]);
        const parsed = Number(String(statOutput).trim().split(/\s+/).pop());
        remoteBytes = Number.isFinite(parsed) ? parsed : 0;
      } catch {
        remoteBytes = 0;
      }
      if (remoteBytes > 0) break;
      if (Date.now() >= deadline) {
        throw new Error(`Perfetto trace remained empty after ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    runAdb(["pull", session.remoteTrace, session.outputPath]);
    let localBytes = 0;
    try {
      localBytes = fs.statSync(session.outputPath).size;
    } catch {
      localBytes = 0;
    }
    if (!Number.isFinite(localBytes) || localBytes <= 0) {
      throw new Error("Perfetto trace is empty after adb pull");
    }
    return {
      status: "collected",
      value: { path: session.outputPath, bytes: localBytes },
      unit: "trace",
      source: "adb.perfetto",
    };
  } finally {
    cleanupPerfettoTrace({ runAdb, session, terminate: false });
  }
}

export async function collectPerfettoTrace({ runAdb, configPath, outputPath, runIndex }) {
  const session = startPerfettoTrace({ runAdb, configPath, outputPath, runIndex });
  return finishPerfettoTrace({ runAdb, session });
}

async function collectRun({ runAdb, options, runIndex }) {
  const perfettoSession = options.perfettoConfig && options.perfettoOutput
    ? startPerfettoTrace({
        runAdb,
        configPath: path.resolve(options.perfettoConfig),
        outputPath: outputPathForRun(options.perfettoOutput, runIndex),
        runIndex,
      })
    : null;

  try {
    const startOutput = runAdb(["shell", "am", "start", "-W", "-n", options.activity]);
    const startup = parseAmStartOutput(startOutput);
    const android = collectAndroidProcessMetrics({
      runAdb,
      packageName: options.packageName,
      webViewPid: options.webViewPid,
    });

    let webview;
  let cdpStatus = "not_executed";
  let cdpPort;
  if (options.cdpEndpoint && !options.skipCdp) {
    cdpPort = parsePort(options.cdpEndpoint);
    if (!cdpPort) throw new Error("CDP endpoint port is invalid");
    runAdb(
      buildCdpForwardArgs({
        port: cdpPort,
        appPid: android.processes.app.pid,
      }),
    );
    try {
      const collected = await collectWebViewMetricsFromEndpoint({
        packageName: options.packageName,
        pid: android.processes.webview.pid,
        process: android.processes.webview,
        endpoint: options.cdpEndpoint,
      });
      webview = collected.metrics;
      cdpStatus = collectorStatusFromMetrics(collected.metrics);
    } finally {
      try {
        runAdb(["forward", "--remove", `tcp:${cdpPort}`]);
      } catch {
        // Cleanup failure must not hide the collection error.
      }
    }
  } else {
    webview = notExecutedGroup(
      [
        "jsHeapUsedBytesAfterGc",
        "domNodes",
        "eventListeners",
        "lcpMs",
        "inpMs",
        "cls",
        "longTasks",
      ],
      options.skipCdp ? "CDP collection was explicitly skipped" : "CDP endpoint was not configured",
    );
  }

  let perfetto;
  let perfettoStatus = "not_executed";
  if (perfettoSession) {
    perfetto = buildPerfettoGroup(
      await finishPerfettoTrace({
        runAdb,
        session: perfettoSession,
      }),
    );
    perfettoStatus = "collected";
  } else {
    perfetto = buildPerfettoGroup({
      status: "not_executed",
      reason: "Perfetto collection was not configured",
    });
  }

    return {
      id: `${options.journeyId}-${runIndex}`,
      status: "collected",
      startup: buildStartupMetrics(startup),
      android: android.metrics,
      webview,
      perfetto,
      _collectorStatus: { cdp: cdpStatus, perfetto: perfettoStatus },
    };
  } catch (error) {
    if (perfettoSession) cleanupPerfettoTrace({ runAdb, session: perfettoSession, terminate: true });
    throw error;
  }
}

export async function runJourney(options) {
  const normalized = {
    journeyId: validateJourneyId(options.journeyId || "synthetic-startup"),
    packageName: validatePackageName(options.packageName || "com.runflow.app"),
    activity: validateActivity(options.activity || "com.runflow.app/.MainActivity"),
    expectedRuns: positiveInteger(options.expectedRuns ?? options.runs ?? 1, "runs"),
    webViewPid: options.webViewPid,
    cdpEndpoint: options.cdpEndpoint,
    skipCdp: options.skipCdp === true,
    perfettoConfig: options.perfettoConfig,
    perfettoOutput: options.perfettoOutput,
  };
  if (options.dryRun) {
    return buildNotExecutedReport({
      journeyId: normalized.journeyId,
      packageName: normalized.packageName,
      activity: normalized.activity,
      expectedRuns: normalized.expectedRuns,
      reason: "dry run; no AVD or ADB collection was started",
    });
  }
  const runAdb = options.runAdb || createAdbRunner({ adbPath: options.adbPath, serial: options.serial });
  const runs = [];
  for (let index = 1; index <= normalized.expectedRuns; index += 1) {
    runs.push(await collectRun({ runAdb, options: normalized, runIndex: index }));
  }
  const cdpStatuses = runs.map((run) => run._collectorStatus.cdp);
  const perfettoStatuses = runs.map((run) => run._collectorStatus.perfetto);
  for (const run of runs) delete run._collectorStatus;
  return {
    schemaVersion: 1,
    status: "collected",
    journey: {
      id: normalized.journeyId,
      packageName: normalized.packageName,
      activity: normalized.activity,
    },
    expectedRuns: normalized.expectedRuns,
    runs,
    collectors: {
      adb: "collected",
      cdp: cdpStatuses.every((status) => status === "collected") ? "collected" : "not_executed",
      perfetto: perfettoStatuses.every((status) => status === "collected") ? "collected" : "not_executed",
    },
  };
}

function parseArgs(argv) {
  const options = {};
  const valueFlags = new Set([
    "--journey",
    "--package",
    "--activity",
    "--runs",
    "--adb",
    "--serial",
    "--webview-pid",
    "--cdp-endpoint",
    "--perfetto-config",
    "--perfetto-output",
    "--output",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--skip-cdp") {
      options.skipCdp = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") return { help: true };
    if (!valueFlags.has(argument)) throw new Error(`unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`missing value for ${argument}`);
    options[argument.slice(2).replaceAll("-", "_")] = value;
    index += 1;
  }
  if (!options.output) throw new Error("--output is required");
  return options;
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(
      "Usage: node scripts/perf/run-journey.mjs --output results.json [--dry-run] [--runs N] [--cdp-endpoint http://127.0.0.1:9222] [--perfetto-config scripts/perf/perfetto-config.pbtxt --perfetto-output trace.pftrace]",
    );
    return;
  }
  const report = await runJourney({
    journeyId: options.journey,
    packageName: options.package,
    activity: options.activity,
    expectedRuns: options.runs,
    adbPath: options.adb,
    serial: options.serial,
    webViewPid: options.webview_pid,
    cdpEndpoint: options.cdp_endpoint,
    perfettoConfig: options.perfetto_config,
    perfettoOutput: options.perfetto_output,
    dryRun: options.dryRun,
    skipCdp: options.skipCdp,
  });
  writeJson(options.output, report);
  console.log(`Performance journey report written with status ${report.status}.`);
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (scriptPath === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Performance journey failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
