const PID_PATTERN = /^\d+$/;

export function collectedMetric(value, unit, source) {
  if (value === null || value === undefined) throw new Error("collected metric value is required");
  return {
    status: "collected",
    value,
    unit: unit ?? null,
    source: source ?? "adb",
  };
}

function normalizePid(value, label = "PID") {
  const text = String(value ?? "").trim();
  if (!PID_PATTERN.test(text)) throw new Error(`${label} must be a positive integer.`);
  const pid = Number(text);
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`${label} must be a positive integer.`);
  return pid;
}

function normalizePackageName(packageName) {
  if (typeof packageName !== "string" || !/^[A-Za-z][A-Za-z0-9_.]*$/.test(packageName)) {
    throw new Error("packageName must be a valid Android package name.");
  }
  return packageName;
}

export function parseProcessTable(output) {
  const processes = [];
  for (const line of String(output ?? "").replaceAll("\r", "").split("\n")) {
    const fields = line.trim().split(/\s+/).filter(Boolean);
    if (fields.length < 2) continue;
    const pidIndex = fields.findIndex((field) => PID_PATTERN.test(field));
    if (pidIndex < 0 || !fields[pidIndex + 1]) continue;
    const pid = Number(fields[pidIndex]);
    if (!Number.isSafeInteger(pid) || pid <= 0) continue;
    const name = fields[pidIndex + 1];
    processes.push({ pid, name, command: fields.slice(pidIndex + 2).join(" ") || name });
  }
  return processes;
}

export function isWebViewProcessName(name, packageName) {
  return (
    typeof name === "string" &&
    typeof packageName === "string" &&
    name.startsWith(`${packageName}:`) &&
    /(renderer|webview|sandboxed_process)/i.test(name)
  );
}

export function parseActivityProcessTable(output) {
  const records = [];
  let current = null;
  const flush = () => {
    if (current && current.packageNames.length > 0) records.push(current);
    current = null;
  };

  for (const line of String(output ?? "").replaceAll("\r", "").split("\n")) {
    const processMatch = line.match(/ProcessRecord\{[^\s}]+\s+(\d+):([^/\s]+)\//);
    if (processMatch) {
      flush();
      current = {
        pid: Number(processMatch[1]),
        name: processMatch[2],
        packageNames: [],
      };
      continue;
    }
    if (!current) continue;
    const packageMatch = line.match(/packageList=\{([^}]*)\}/);
    if (packageMatch) {
      current.packageNames = packageMatch[1].split(/[,\s]+/).filter(Boolean);
    }
    const pidMatch = line.match(/^\s*pid=(\d+)\s*$/);
    if (pidMatch) current.pid = Number(pidMatch[1]);
  }
  flush();
  return records;
}

function isRendererProcessName(name) {
  return typeof name === "string" && /(renderer|webview|sandboxed_process)/i.test(name);
}

export function resolveAppProcess({ processes, packageName }) {
  const normalizedPackage = normalizePackageName(packageName);
  if (!Array.isArray(processes)) throw new Error("processes must be an array.");
  const matches = processes.filter((process) => process?.name === normalizedPackage);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one app process for ${normalizedPackage}; found ${matches.length}.`);
  }
  return matches[0];
}

export function resolveWebViewProcess({ processes, packageName, webViewPid, activityProcesses = [] }) {
  const normalizedPackage = normalizePackageName(packageName);
  if (!Array.isArray(processes)) throw new Error("processes must be an array.");
  if (!Array.isArray(activityProcesses)) throw new Error("activityProcesses must be an array.");
  const activityByPid = new Map(
    activityProcesses
      .filter((process) => Number.isSafeInteger(Number(process?.pid)))
      .map((process) => [Number(process.pid), process]),
  );
  const isOwnedRenderer = (process) => {
    if (!isRendererProcessName(process?.name)) return false;
    if (isWebViewProcessName(process.name, normalizedPackage)) return true;
    return activityByPid.get(Number(process.pid))?.packageNames?.includes(normalizedPackage) === true;
  };
  const withOwnership = (process) => {
    const owner = activityByPid.get(Number(process.pid));
    return owner ? { ...process, packageNames: owner.packageNames } : process;
  };
  const candidates = processes.filter(isOwnedRenderer);
  if (webViewPid !== undefined && webViewPid !== null) {
    const requestedPid = normalizePid(webViewPid, "WebView PID");
    const selected = processes.find((process) => Number(process?.pid) === requestedPid);
    if (!selected) throw new Error(`WebView PID ${requestedPid} was not found in the selected process table.`);
    if (!isOwnedRenderer(selected)) {
      throw new Error(`PID ${requestedPid} is not a WebView renderer for ${normalizedPackage}.`);
    }
    return withOwnership(selected);
  }
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one WebView renderer for ${normalizedPackage}; found ${candidates.length}. Pass --webview-pid explicitly when needed.`,
    );
  }
  return withOwnership(candidates[0]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMemoryValue(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(
      `^\\s*${escapeRegExp(label)}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(kB|KB|KiB|MB|MiB|B)?`,
      "im",
    );
    const match = String(text ?? "").match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    const unit = (match[2] || "KiB").toLowerCase();
    const factor = unit === "mb" || unit === "mib" ? 1024 : unit === "b" ? 1 / 1024 : 1;
    return value * factor;
  }
  return null;
}

function parseTotalPrivateDirty(text) {
  const totalRow = String(text ?? "")
    .replaceAll("\r", "")
    .split("\n")
    .find((line) => /^\s*TOTAL\s+\d/.test(line));
  if (!totalRow) return null;
  const fields = totalRow.trim().split(/\s+/);
  const value = Number(fields[2]);
  return Number.isFinite(value) ? value : null;
}

export function parseMeminfo(output) {
  const text = String(output ?? "");
  return {
    pssKb: parseMemoryValue(text, ["TOTAL PSS", "Pss"]),
    privateDirtyKb:
      parseMemoryValue(text, ["TOTAL PRIVATE DIRTY", "Private Dirty"]) ?? parseTotalPrivateDirty(text),
    graphicsKb: parseMemoryValue(text, ["Graphics", "TOTAL GRAPHICS"]),
  };
}

function requireNumber(value, metricName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`missing Android metric: ${metricName}`);
  }
  return value;
}

export function parseGfxInfo(output) {
  const text = String(output ?? "");
  const totalFrames = text.match(/Total frames rendered:\s*(\d+)/i)?.[1];
  const jankyFrames = text.match(/Janky frames:\s*(\d+)/i)?.[1];
  if (totalFrames === undefined || jankyFrames === undefined) {
    throw new Error("missing Android metric: gfxinfo");
  }
  const percentiles = {};
  for (const match of text.matchAll(/(50|90|95|99)th percentile:\s*([0-9]+(?:\.[0-9]+)?)ms/gi)) {
    percentiles[`p${match[1]}`] = Number(match[2]);
  }
  return {
    totalFrames: Number(totalFrames),
    jankyFrames: Number(jankyFrames),
    jankPercent: Number(totalFrames) > 0 ? (Number(jankyFrames) / Number(totalFrames)) * 100 : 0,
    frameTimePercentilesMs: percentiles,
  };
}

export function parseFrameTimeline(output) {
  const lines = String(output ?? "").replaceAll("\r", "").split("\n");
  const headerIndex = lines.findIndex((line) => /IntendedVsync/i.test(line) && /FrameCompleted/i.test(line));
  if (headerIndex < 0) throw new Error("missing Android metric: frameTimeline");
  const frameCount = lines
    .slice(headerIndex + 1)
    .filter((line) => line.trim() && /^\s*\d+[,\s]/.test(line)).length;
  if (frameCount === 0) throw new Error("missing Android metric: frameTimeline");
  return { frameCount };
}

export function parseExitInfo(output) {
  const text = String(output ?? "");
  const records = text
    .split("\n")
    .filter((line) => /ApplicationExitInfo|reason=|status=|timestamp=/i.test(line)).length;
  return { records };
}

export function summarizeLogcat(output) {
  const lines = String(output ?? "")
    .replaceAll("\r", "")
    .split("\n")
    .filter((line) => line.trim());
  return {
    lines: lines.length,
    fatalExceptions: lines.filter((line) => /FATAL EXCEPTION|Fatal signal/i.test(line)).length,
    anrs: lines.filter((line) => /\bANR\b|Application Not Responding/i.test(line)).length,
    outOfMemory: lines.filter((line) => /OutOfMemoryError|low memory killer/i.test(line)).length,
  };
}

/**
 * @param {{
 *   runAdb: (args: string[]) => string,
 *   packageName: string,
 *   webViewPid?: string | number
 * }} options
 */
export function collectAndroidProcessMetrics({ runAdb, packageName, webViewPid = undefined }) {
  if (typeof runAdb !== "function") throw new Error("runAdb is required");
  const normalizedPackage = normalizePackageName(packageName);
  const processes = parseProcessTable(runAdb(["shell", "ps", "-A", "-o", "PID,NAME,ARGS"]));
  const appProcess = resolveAppProcess({ processes, packageName: normalizedPackage });
  const hasPackageNamedRenderer = processes.some((process) =>
    isWebViewProcessName(process?.name, normalizedPackage),
  );
  const activityProcesses = hasPackageNamedRenderer
    ? []
    : parseActivityProcessTable(runAdb(["shell", "dumpsys", "activity", "processes"]));
  const webViewProcess = resolveWebViewProcess({
    processes,
    packageName: normalizedPackage,
    webViewPid,
    activityProcesses,
  });
  const appMemory = parseMeminfo(runAdb(["shell", "dumpsys", "meminfo", String(appProcess.pid)]));
  const appPssKb = requireNumber(appMemory.pssKb, "appPssKb");
  const appPrivateDirtyKb = requireNumber(appMemory.privateDirtyKb, "appPrivateDirtyKb");
  const appGraphicsKb = requireNumber(appMemory.graphicsKb, "appGraphicsKb");
  const webViewMemory = parseMeminfo(runAdb(["shell", "dumpsys", "meminfo", String(webViewProcess.pid)]));
  const webviewPssKb = requireNumber(webViewMemory.pssKb, "webviewPssKb");
  const gfxinfo = parseGfxInfo(runAdb(["shell", "dumpsys", "gfxinfo", normalizedPackage]));
  const frameTimeline = parseFrameTimeline(
    runAdb(["shell", "dumpsys", "gfxinfo", normalizedPackage, "framestats"]),
  );
  const exitInfo = parseExitInfo(runAdb(["shell", "dumpsys", "activity", "exit-info", normalizedPackage]));
  const logcat = summarizeLogcat(runAdb(["logcat", "-d", "-t", "200"]));

  return {
    processes: {
      app: { pid: appProcess.pid, name: appProcess.name },
      webview: {
        pid: webViewProcess.pid,
        name: webViewProcess.name,
        packageNames: webViewProcess.packageNames ?? [],
      },
    },
    metrics: {
      appPssKb: collectedMetric(requireNumber(appMemory.pssKb, "appPssKb"), "KiB", "adb.dumpsys.meminfo"),
      appPrivateDirtyKb: collectedMetric(
        requireNumber(appMemory.privateDirtyKb, "appPrivateDirtyKb"),
        "KiB",
        "adb.dumpsys.meminfo",
      ),
      appGraphicsKb: collectedMetric(
        requireNumber(appMemory.graphicsKb, "appGraphicsKb"),
        "KiB",
        "adb.dumpsys.meminfo",
      ),
      webviewPssKb: collectedMetric(webviewPssKb, "KiB", "adb.dumpsys.meminfo"),
      gfxinfo: collectedMetric(gfxinfo, "frames", "adb.dumpsys.gfxinfo"),
      frameTimeline: collectedMetric(frameTimeline, "frames", "adb.dumpsys.gfxinfo framestats"),
      exitInfo: collectedMetric(exitInfo, "records", "adb.dumpsys.activity.exit-info"),
      logcat: collectedMetric(logcat, "summary", "adb.logcat"),
    },
  };
}
