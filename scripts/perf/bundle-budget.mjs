import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function resolveUnder(root, relativePath) {
  const outputRoot = path.resolve(root, "out", "_next");
  const resolved = path.resolve(outputRoot, relativePath);
  if (resolved !== outputRoot && !resolved.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`manifest path escapes output directory: ${relativePath}`);
  }
  return resolved;
}

function jsEntriesForRoute(entries = []) {
  return [...new Set(entries.filter((entry) => entry.endsWith(".js")))];
}

function bytesForEntries(root, entries) {
  let total = 0;
  const files = [];
  for (const entry of jsEntriesForRoute(entries)) {
    const filePath = resolveUnder(root, entry);
    if (!fs.existsSync(filePath)) throw new Error(`bundle chunk missing: ${entry}`);
    const size = fs.statSync(filePath).size;
    total += size;
    files.push({ entry, filePath, size });
  }
  return { total, files };
}

function containsPackage(text, packageName) {
  if (packageName.toLowerCase() === "three") {
    return /\bthree\b|@react-three|three\.min/i.test(text);
  }
  return text.toLowerCase().includes(packageName.toLowerCase());
}

export function auditBundle(root = process.cwd()) {
  const outRoot = path.join(root, "out");
  const manifestPath = path.join(root, ".next", "app-build-manifest.json");
  const baselinePath = path.join(root, "scripts", "perf", "bundle-budget.json");
  if (!fs.existsSync(outRoot)) throw new Error(`out directory missing: ${outRoot}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`app build manifest missing: ${manifestPath}`);
  if (!fs.existsSync(baselinePath)) throw new Error(`bundle baseline missing: ${baselinePath}`);

  const manifest = readJson(manifestPath);
  const baseline = readJson(baselinePath);
  const pages = manifest.pages;
  if (!pages || typeof pages !== "object") throw new Error("app build manifest has no pages");
  if (!pages["/layout"]) throw new Error("app build manifest has no /layout entry");
  if (!Number.isFinite(baseline.maxRegressionRatio) || baseline.maxRegressionRatio <= 0) {
    throw new Error("bundle baseline maxRegressionRatio must be positive");
  }

  const chunksRoot = path.join(outRoot, "_next", "static", "chunks");
  const chunkFiles = walkFiles(chunksRoot).filter((filePath) => filePath.endsWith(".js"));
  if (chunkFiles.length === 0) throw new Error(`no JavaScript chunks found in ${chunksRoot}`);
  const totalBytes = chunkFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  const initial = bytesForEntries(root, pages["/layout"]);
  const violations = [];

  const totalBaseline = baseline.baselineTotalBytes;
  if (!Number.isFinite(totalBaseline)) throw new Error("bundle baseline missing baselineTotalBytes");
  if (totalBytes > Math.ceil(totalBaseline * baseline.maxRegressionRatio)) {
    violations.push(
      `total bundle ${totalBytes} bytes exceeds budget ${Math.ceil(totalBaseline * baseline.maxRegressionRatio)} bytes`,
    );
  }

  const initialBaseline = baseline.baselineInitialBytes;
  if (!Number.isFinite(initialBaseline)) throw new Error("bundle baseline missing baselineInitialBytes");
  if (initial.total > Math.ceil(initialBaseline * baseline.maxRegressionRatio)) {
    violations.push(
      `initial bundle ${initial.total} bytes exceeds budget ${Math.ceil(initialBaseline * baseline.maxRegressionRatio)} bytes`,
    );
  }

  for (const packageName of baseline.forbiddenInitialPackages ?? []) {
    for (const file of initial.files) {
      const text = fs.readFileSync(file.filePath, "utf8");
      if (containsPackage(text, packageName)) {
        violations.push(`forbidden package ${packageName} found in initial chunk ${file.entry}`);
      }
    }
  }

  const routeMetrics = {};
  for (const [route, routeBudget] of Object.entries(baseline.routes ?? {})) {
    const routeEntries = pages[route];
    if (!routeEntries) {
      violations.push(`route ${route} is missing from app build manifest`);
      continue;
    }
    const metric = bytesForEntries(root, routeEntries);
    const baselineBytes = routeBudget.baselineJsBytes;
    if (!Number.isFinite(baselineBytes)) {
      throw new Error(`bundle baseline missing baselineJsBytes for ${route}`);
    }
    const allowed = Math.ceil(baselineBytes * baseline.maxRegressionRatio);
    routeMetrics[route] = { jsBytes: metric.total, allowedBytes: allowed, files: metric.files.length };
    if (metric.total > allowed) {
      violations.push(`route ${route} bundle ${metric.total} bytes exceeds budget ${allowed} bytes`);
    }
  }

  return {
    totalBytes,
    initialBytes: initial.total,
    routeMetrics,
    violations,
  };
}

function getRoot(args) {
  const index = args.indexOf("--root");
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : process.cwd();
}

try {
  const scriptPath = path.resolve(fileURLToPath(import.meta.url));
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (scriptPath === invokedPath) {
    const report = auditBundle(getRoot(process.argv.slice(2)));
    if (report.violations.length > 0) {
      console.error("Bundle budget failed:");
      for (const violation of report.violations) console.error(`- ${violation}`);
      process.exitCode = 1;
    } else {
      console.log(
        `Bundle budget OK: total ${report.totalBytes} bytes, initial ${report.initialBytes} bytes.`,
      );
    }
  }
} catch (error) {
  console.error(`Bundle budget failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
