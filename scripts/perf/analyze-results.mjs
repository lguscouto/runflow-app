import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_METRICS = Object.freeze([
  "startup.totalTimeMs",
  "startup.waitTimeMs",
  "android.appPssKb",
  "android.appPrivateDirtyKb",
  "android.appGraphicsKb",
  "android.webviewPssKb",
  "android.gfxinfo",
  "android.frameTimeline",
  "android.exitInfo",
  "android.logcat",
  "perfetto.trace",
  "webview.jsHeapUsedBytesAfterGc",
  "webview.domNodes",
  "webview.eventListeners",
  "webview.lcpMs",
  "webview.inpMs",
  "webview.cls",
  "webview.longTasks",
]);

export const OPTIONAL_METRICS = Object.freeze(["startup.thisTimeMs"]);

const NUMERIC_METRICS = new Set([
  "startup.totalTimeMs",
  "startup.thisTimeMs",
  "startup.waitTimeMs",
  "android.appPssKb",
  "android.appPrivateDirtyKb",
  "android.appGraphicsKb",
  "android.webviewPssKb",
  "webview.jsHeapUsedBytesAfterGc",
  "webview.domNodes",
  "webview.eventListeners",
  "webview.lcpMs",
  "webview.inpMs",
  "webview.cls",
]);

const NON_NEGATIVE_INTEGER_METRICS = new Set([
  "webview.domNodes",
  "webview.eventListeners",
]);

const STRUCTURED_METRICS = new Set([
  "android.gfxinfo",
  "android.frameTimeline",
  "android.exitInfo",
  "android.logcat",
  "perfetto.trace",
  "webview.longTasks",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function valueAtPath(record, dottedPath) {
  return dottedPath.split(".").reduce((current, segment) => current?.[segment], record);
}

function isNonNegativeFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidNumericMetric(metricPath, value) {
  if (!isNonNegativeFinite(value)) return false;
  return NON_NEGATIVE_INTEGER_METRICS.has(metricPath) ? Number.isInteger(value) : true;
}

function isValidStructuredMetric(metricPath, value) {
  if (!STRUCTURED_METRICS.has(metricPath) || !isRecord(value)) return false;
  switch (metricPath) {
    case "android.gfxinfo":
      return (
        isNonNegativeInteger(value.totalFrames) &&
        isNonNegativeInteger(value.jankyFrames) &&
        value.jankyFrames <= value.totalFrames &&
        isNonNegativeFinite(value.jankPercent) &&
        value.jankPercent <= 100 &&
        isRecord(value.frameTimePercentilesMs)
      );
    case "android.frameTimeline":
      return Number.isInteger(value.frameCount) && value.frameCount > 0;
    case "android.exitInfo":
      return isNonNegativeInteger(value.records);
    case "android.logcat":
      return (
        isNonNegativeInteger(value.lines) &&
        isNonNegativeInteger(value.fatalExceptions) &&
        isNonNegativeInteger(value.anrs)
      );
    case "perfetto.trace":
      return (
        typeof value.path === "string" &&
        value.path.trim() !== "" &&
        Number.isInteger(value.bytes) &&
        value.bytes > 0
      );
    case "webview.longTasks":
      return (
        isNonNegativeInteger(value.count) &&
        isNonNegativeFinite(value.maxMs) &&
        (value.count === 0 ? value.maxMs === 0 : value.maxMs > 0)
      );
    default:
      return false;
  }
}

function validateMetric(metric, metricPath, runId) {
  if (!isRecord(metric) || metric.status === undefined) {
    throw new Error(`missing metric: ${metricPath} in ${runId}`);
  }
  if (metric.status !== "collected") {
    throw new Error(`metric not collected: ${metricPath} in ${runId} (${metric.status})`);
  }
  if (typeof metric.unit !== "string" || metric.unit.trim() === "" || typeof metric.source !== "string" || metric.source.trim() === "") {
    throw new Error(`missing metric provenance: ${metricPath} in ${runId}`);
  }
  if (metric.value === null || metric.value === undefined) {
    throw new Error(`missing metric: ${metricPath} in ${runId}`);
  }
  if (NUMERIC_METRICS.has(metricPath) && !isValidNumericMetric(metricPath, metric.value)) {
    throw new Error(`invalid numeric metric: ${metricPath} in ${runId}`);
  }
  if (STRUCTURED_METRICS.has(metricPath) && !isValidStructuredMetric(metricPath, metric.value)) {
    if (metricPath === "perfetto.trace") {
      throw new Error(`invalid trace metric: ${metricPath} in ${runId}`);
    }
    throw new Error(`invalid structured metric: ${metricPath} in ${runId}`);
  }
  return metric;
}

function validateInput(document) {
  if (!isRecord(document)) throw new Error("performance results must be a JSON object");
  if (document.schemaVersion !== 1) throw new Error("performance results schemaVersion must be 1");
  if (document.status === undefined) {
    throw new Error("performance results status is required");
  }
  if (document.status !== "collected") {
    throw new Error(`incomplete analysis: result status is ${String(document.status)}`);
  }
  if (!isRecord(document.collectors)) {
    throw new Error("performance results collectors are required");
  }
  for (const collector of ["adb", "cdp", "perfetto"]) {
    if (document.collectors[collector] !== "collected") {
      throw new Error(`incomplete analysis: collector ${collector} is ${String(document.collectors[collector])}`);
    }
  }
  if (!isRecord(document.journey) || typeof document.journey.id !== "string" || document.journey.id.trim() === "") {
    throw new Error("performance results journey.id is required");
  }
  if (!Number.isInteger(document.expectedRuns) || document.expectedRuns <= 0) {
    throw new Error("performance results expectedRuns must be a positive integer");
  }
  if (!Array.isArray(document.runs)) {
    throw new Error("performance results runs must be an array");
  }
  if (document.runs.length !== document.expectedRuns) {
    throw new Error(
      `incomplete analysis: expected ${document.expectedRuns} runs, observed ${document.runs.length}`,
    );
  }

  const ids = new Set();
  for (const [index, run] of document.runs.entries()) {
    const runId = typeof run?.id === "string" && run.id.trim() ? run.id : `run-${index + 1}`;
    if (!isRecord(run) || run.status !== "collected") {
      throw new Error(`incomplete analysis: ${runId} is not collected`);
    }
    if (ids.has(runId)) throw new Error(`duplicate run id: ${runId}`);
    ids.add(runId);
    for (const metricPath of REQUIRED_METRICS) {
      validateMetric(valueAtPath(run, metricPath), metricPath, runId);
    }
    for (const metricPath of OPTIONAL_METRICS) {
      const metric = valueAtPath(run, metricPath);
      if (metric === undefined) continue;
      if (!isRecord(metric) || metric.status === undefined) {
        throw new Error(`missing metric: ${metricPath} in ${runId}`);
      }
      if (metric.status === "collected") {
        validateMetric(metric, metricPath, runId);
      } else if (metric.status !== "not_executed" || typeof metric.reason !== "string" || metric.reason.trim() === "") {
        throw new Error(`invalid optional metric state: ${metricPath} in ${runId}`);
      }
    }
  }
  return document;
}

export function percentile(values, percentileValue) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("percentile requires at least one value");
  if (!Number.isFinite(percentileValue) || percentileValue < 0 || percentileValue > 100) {
    throw new Error("percentile must be between 0 and 100");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[rank];
}

function summarizeMetric(runs, metricPath) {
  const metrics = runs.map((run) => valueAtPath(run, metricPath));
  const first = metrics[0];
  if (NUMERIC_METRICS.has(metricPath)) {
    const values = metrics.map((metric) => metric.value);
    return {
      count: values.length,
      unit: first.unit ?? null,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
    };
  }
  return {
    count: metrics.length,
    unit: first.unit ?? null,
    collectedRuns: metrics.length,
  };
}

function summarizeOptionalMetric(runs, metricPath) {
  const metrics = runs.map((run) => valueAtPath(run, metricPath));
  if (metrics.every((metric) => metric?.status === "collected")) {
    return summarizeMetric(runs, metricPath);
  }
  const omitted = metrics.find((metric) => metric?.status === "not_executed");
  return {
    status: "not_executed",
    reason: omitted?.reason ?? `optional metric ${metricPath} was not present in every run`,
  };
}

export function analyzeResults(document) {
  const validated = validateInput(document);
  const metrics = Object.fromEntries([
    ...REQUIRED_METRICS.map((metricPath) => [metricPath, summarizeMetric(validated.runs, metricPath)]),
    ...OPTIONAL_METRICS.map((metricPath) => [metricPath, summarizeOptionalMetric(validated.runs, metricPath)]),
  ]);
  const limitations = OPTIONAL_METRICS.flatMap((metricPath) => {
    const summary = metrics[metricPath];
    return summary.status === "not_executed" ? [`${metricPath}: ${summary.reason}`] : [];
  });
  return {
    schemaVersion: 1,
    status: "verified",
    journey: { id: validated.journey.id },
    expectedRuns: validated.expectedRuns,
    sampleCount: validated.runs.length,
    metrics,
    limitations,
  };
}

export function readResults(filePath) {
  const resolved = path.resolve(filePath);
  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch {
    throw new Error("performance results input could not be read");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("performance results input is not valid JSON");
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--input" || argument === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error(`missing value for ${argument}`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if (!options.input) throw new Error("--input is required");
  return options;
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log("Usage: node scripts/perf/analyze-results.mjs --input results.json [--output analysis.json]");
    return;
  }
  const report = analyzeResults(readResults(options.input));
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) fs.writeFileSync(path.resolve(options.output), serialized, "utf8");
  else process.stdout.write(serialized);
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (scriptPath === invokedPath) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Performance analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
