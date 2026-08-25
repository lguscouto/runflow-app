import {
  collectedMetric,
  isWebViewProcessName,
  resolveWebViewProcess,
} from "./android-processes.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function requireFiniteNumber(value, metricName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`missing WebView metric: ${metricName}`);
  }
  return value;
}

function requireRecord(value, metricName) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`missing WebView metric: ${metricName}`);
  }
  return value;
}

function normalizeEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("CDP endpoint must be a valid URL");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error("CDP endpoint must use a loopback host");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("CDP endpoint must use HTTP or HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveWebViewPid({ packageName, pid, processes }) {
  return resolveWebViewProcess({ packageName, webViewPid: pid, processes }).pid;
}

export function assertWebViewProcess({ packageName, pid, process }) {
  if (!process || Number(process.pid) !== Number(pid)) {
    throw new Error(`WebView PID ${pid} does not match the selected process record.`);
  }
  const isolatedRendererOwnedByPackage =
    Array.isArray(process?.packageNames) &&
    process.packageNames.includes(packageName) &&
    /(renderer|webview|sandboxed_process)/i.test(String(process.name ?? ""));
  if (!isWebViewProcessName(process.name, packageName) && !isolatedRendererOwnedByPackage) {
    throw new Error(`PID ${pid} is not a WebView renderer for ${packageName}.`);
  }
  return process;
}

const PERFORMANCE_OBSERVER_STATE_KEY = "__runflowWebViewPerformanceObservers__";

export const PERFORMANCE_OBSERVER_INSTALL_EXPRESSION = `(() => {
  const key = ${JSON.stringify(PERFORMANCE_OBSERVER_STATE_KEY)};
  if (globalThis !== globalThis.top) return { installed: false, reason: "subframe" };
  const existing = globalThis[key];
  if (existing?.version === 2) {
    return { installed: true, capabilities: existing.capabilities };
  }

  const state = {
    version: 2,
    observers: [],
    capabilities: {},
    lcpMs: null,
    inpMs: null,
    cls: null,
    longTasks: null,
  };
  globalThis[key] = state;

  const finiteNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const observe = (type, options, consume) => {
    if (typeof globalThis.PerformanceObserver !== "function") {
      state.capabilities[type] = false;
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => {
        try {
          consume(list.getEntries());
        } catch {
          // A malformed entry must not turn a valid CDP session into a fabricated metric.
        }
      });
      observer.observe({ type, ...options });
      state.observers.push(observer);
      state.capabilities[type] = true;
    } catch {
      state.capabilities[type] = false;
    }
  };

  observe("largest-contentful-paint", { buffered: true }, (entries) => {
    for (const entry of entries) {
      const value = finiteNumber(entry.startTime);
      if (value !== null && value >= 0) {
        state.lcpMs = state.lcpMs === null ? value : Math.max(state.lcpMs, value);
      }
    }
  });
  observe("event", { buffered: true, durationThreshold: 16 }, (entries) => {
    for (const entry of entries) {
      const interactionId = finiteNumber(entry.interactionId);
      const value = finiteNumber(entry.duration);
      if (interactionId === null || interactionId <= 0 || value === null || value < 0) continue;
      state.inpMs = state.inpMs === null ? value : Math.max(state.inpMs, value);
    }
  });
  observe("layout-shift", { buffered: true }, (entries) => {
    const entriesAreValid = entries.every(
      (entry) =>
        typeof entry.hadRecentInput === "boolean" &&
        finiteNumber(entry.value) !== null &&
        finiteNumber(entry.value) >= 0,
    );
    if (!entriesAreValid) return;
    for (const entry of entries) {
      if (state.cls === null) state.cls = 0;
      if (!entry.hadRecentInput) state.cls += entry.value;
    }
  });
  observe("longtask", { buffered: true }, (entries) => {
    const entriesAreValid = entries.every(
      (entry) => {
        const value = finiteNumber(entry.duration);
        return value !== null && value > 0;
      },
    );
    if (!entriesAreValid || entries.length === 0) return;
    if (state.longTasks === null) state.longTasks = { count: 0, maxMs: 0 };
    state.longTasks.count += entries.length;
    for (const entry of entries) {
      state.longTasks.maxMs = Math.max(state.longTasks.maxMs, entry.duration);
    }
  });

  return { installed: true, capabilities: state.capabilities };
})()`;

export const PAGE_METRICS_EXPRESSION = `(() => {
  const key = ${JSON.stringify(PERFORMANCE_OBSERVER_STATE_KEY)};
  const state = globalThis[key];
  const entriesOf = (type) => {
    try {
      const entries = performance.getEntriesByType(type);
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  };
  const finiteNumber = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const lcpEntries = entriesOf("largest-contentful-paint");
  const eventEntries = entriesOf("event");
  const shiftEntries = entriesOf("layout-shift");
  const longTaskEntries = entriesOf("longtask");
  const lcpFromTimeline = lcpEntries.length
    ? finiteNumber(lcpEntries[lcpEntries.length - 1].startTime)
    : null;
  const eventCandidates = eventEntries.filter((entry) => {
    const interactionId = finiteNumber(entry.interactionId);
    const duration = finiteNumber(entry.duration);
    return interactionId !== null && interactionId > 0 && duration !== null && duration >= 0;
  });
  const inpFromTimeline = eventCandidates.length
    ? Math.max(...eventCandidates.map((entry) => entry.duration))
    : null;
  const shiftEntriesAreValid = shiftEntries.every(
    (entry) =>
      typeof entry.hadRecentInput === "boolean" &&
      finiteNumber(entry.value) !== null &&
      finiteNumber(entry.value) >= 0,
  );
  const clsFromTimeline = shiftEntries.length > 0 && shiftEntriesAreValid
    ? shiftEntries.reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0)
    : null;
  const longTaskEntriesAreValid = longTaskEntries.every((entry) => {
    const duration = finiteNumber(entry.duration);
    return duration !== null && duration > 0;
  });
  const longTasksFromTimeline = longTaskEntries.length > 0 && longTaskEntriesAreValid
    ? {
        count: longTaskEntries.length,
        maxMs: Math.max(...longTaskEntries.map((entry) => entry.duration)),
      }
    : null;
  const lcpMs = lcpFromTimeline !== null && lcpFromTimeline >= 0
    ? lcpFromTimeline
    : finiteNumber(state?.lcpMs);
  const inpMs = inpFromTimeline ?? finiteNumber(state?.inpMs);
  const cls = clsFromTimeline ?? finiteNumber(state?.cls);
  const longTasks = longTasksFromTimeline ?? state?.longTasks ?? null;
  return {
    domNodes: document.querySelectorAll("*").length,
    lcpMs,
    inpMs,
    cls,
    longTasks,
  };
})()`;

const PERFORMANCE_OBSERVER_CLEANUP_EXPRESSION = `(() => {
  const key = ${JSON.stringify(PERFORMANCE_OBSERVER_STATE_KEY)};
  const state = globalThis[key];
  for (const observer of state?.observers ?? []) {
    try {
      observer.disconnect();
    } catch {
      // Cleanup is best effort and must not replace the collection result.
    }
  }
  try {
    delete globalThis[key];
  } catch {
    // The isolated page may be tearing down already.
  }
  return { cleaned: true };
})()`;

function notExecutedMetric(reason) {
  return { status: "not_executed", reason };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function waitForMilliseconds(milliseconds) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizePollOption(value, fallback, { minimum, maximum }) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

export async function collectWebViewMetrics({
  packageName,
  pid,
  process,
  session,
  performancePollAttempts = 5,
  performancePollIntervalMs = 50,
}) {
  assertWebViewProcess({ packageName, pid, process });
  if (!session || typeof session.send !== "function") {
    throw new Error("CDP session is required; WebView metrics were not executed");
  }

  const pollAttempts = Math.floor(
    normalizePollOption(performancePollAttempts, 5, { minimum: 1, maximum: 20 }),
  );
  const pollIntervalMs = normalizePollOption(performancePollIntervalMs, 50, {
    minimum: 0,
    maximum: 1000,
  });

  await session.send("HeapProfiler.collectGarbage");
  const heapUsage = await session.send("Runtime.getHeapUsage");
  const heapUsedBytes = requireFiniteNumber(heapUsage?.usedSize, "jsHeapUsedBytesAfterGc");

  let pageMetrics;
  let observerSetupAttempted = false;
  let newDocumentScriptIdentifier;
  try {
    observerSetupAttempted = true;
    try {
      const scriptResult = await session.send("Page.addScriptToEvaluateOnNewDocument", {
        source: PERFORMANCE_OBSERVER_INSTALL_EXPRESSION,
        runImmediately: true,
      });
      newDocumentScriptIdentifier = scriptResult?.identifier;
    } catch {
      // Older WebView CDP versions may not expose Page script injection.
    }
    try {
      await session.send("Runtime.evaluate", {
        expression: PERFORMANCE_OBSERVER_INSTALL_EXPRESSION,
        returnByValue: true,
        awaitPromise: true,
      });
    } catch {
      // The direct performance timeline remains a legitimate fallback when observer setup is unavailable.
    }

    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      const pageResult = await session.send("Runtime.evaluate", {
        expression: PAGE_METRICS_EXPRESSION,
        returnByValue: true,
        awaitPromise: true,
      });
      pageMetrics = requireRecord(pageResult?.result?.value, "pageMetrics");
      if (isFiniteNumber(pageMetrics.lcpMs) && isFiniteNumber(pageMetrics.inpMs)) break;
      if (attempt + 1 < pollAttempts) await waitForMilliseconds(pollIntervalMs);
    }
  } finally {
    if (observerSetupAttempted) {
      try {
        await session.send("Runtime.evaluate", {
          expression: PERFORMANCE_OBSERVER_CLEANUP_EXPRESSION,
          returnByValue: true,
          awaitPromise: true,
        });
      } catch {
        // Cleanup failure must not hide the metric or transport failure that triggered it.
      }
      if (newDocumentScriptIdentifier) {
        try {
          await session.send("Page.removeScriptToEvaluateOnNewDocument", {
            identifier: newDocumentScriptIdentifier,
          });
        } catch {
          // Cleanup failure must not hide the metric or transport failure that triggered it.
        }
      }
    }
  }

  const checkedPageMetrics = requireRecord(pageMetrics, "pageMetrics");
  const domNodes = requireFiniteNumber(checkedPageMetrics.domNodes, "domNodes");
  const cls = checkedPageMetrics.cls;
  const longTasks = checkedPageMetrics.longTasks;
  const hasCollectedLongTasks =
    longTasks !== null &&
    typeof longTasks === "object" &&
    !Array.isArray(longTasks) &&
    isFiniteNumber(longTasks.count) &&
    isFiniteNumber(longTasks.maxMs);

  const windowResult = await session.send("Runtime.evaluate", { expression: "window" });
  const objectId = windowResult?.result?.objectId;
  if (!objectId) throw new Error("missing WebView metric: eventListeners");
  let listeners;
  try {
    const listenerResult = await session.send("DOMDebugger.getEventListeners", { objectId });
    listeners = listenerResult?.listeners;
    if (!Array.isArray(listeners)) throw new Error("missing WebView metric: eventListeners");
  } finally {
    try {
      await session.send("Runtime.releaseObject", { objectId });
    } catch {
      // Releasing a diagnostic object is best effort and must not replace the collection result.
    }
  }

  const vitalsUnavailableReason =
    "WebView did not expose a buffered PerformanceObserver entry for this metric";
  return {
    process: { pid: Number(pid), name: process.name },
    metrics: {
      jsHeapUsedBytesAfterGc: collectedMetric(heapUsedBytes, "bytes", "cdp.Runtime.getHeapUsage"),
      domNodes: collectedMetric(domNodes, "nodes", "cdp.Runtime.evaluate"),
      eventListeners: collectedMetric(listeners.length, "listeners", "cdp.DOMDebugger.getEventListeners"),
      lcpMs: isFiniteNumber(checkedPageMetrics.lcpMs)
        ? collectedMetric(checkedPageMetrics.lcpMs, "ms", "cdp.performance")
        : notExecutedMetric(vitalsUnavailableReason),
      inpMs: isFiniteNumber(checkedPageMetrics.inpMs)
        ? collectedMetric(checkedPageMetrics.inpMs, "ms", "cdp.performance")
        : notExecutedMetric(vitalsUnavailableReason),
      cls: isFiniteNumber(cls)
        ? collectedMetric(cls, "score", "cdp.performance")
        : notExecutedMetric(vitalsUnavailableReason),
      longTasks: hasCollectedLongTasks
        ? collectedMetric(longTasks, "tasks", "cdp.performance")
        : notExecutedMetric(vitalsUnavailableReason),
    },
  };
}

/**
 * @param {unknown} payload
 * @param {string | undefined} endpoint
 */
export function normalizeCdpTargets(payload, endpoint = undefined) {
  return normalizeCdpTargetsForEndpoint(payload, endpoint);
}

function effectivePort(url) {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" || url.protocol === "wss:" ? 443 : 80;
}

function isSafeWebSocketDebuggerUrl(value, endpoint = undefined) {
  if (typeof value !== "string") return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname)) return false;
  if (endpoint === undefined) return true;
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return false;
  }
  return effectivePort(url) === effectivePort(endpointUrl);
}

function normalizeCdpTargetsForEndpoint(payload, endpoint = undefined) {
  const targets = Array.isArray(payload) ? payload : payload?.targets;
  if (!Array.isArray(targets)) throw new Error("CDP target response is invalid");
  return targets.filter(
    (target) =>
      target &&
      target.type === "page" &&
      isSafeWebSocketDebuggerUrl(target.webSocketDebuggerUrl, endpoint),
  );
}

async function defaultFetchJson(url) {
  if (typeof fetch !== "function") throw new Error("fetch is unavailable; WebView CDP was not executed");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CDP endpoint returned HTTP ${response.status}`);
  return response.json();
}

function eventDataToText(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  return String(data);
}

export async function connectCdpTarget({ webSocketDebuggerUrl, WebSocketImpl = globalThis.WebSocket }) {
  if (!isSafeWebSocketDebuggerUrl(webSocketDebuggerUrl)) {
    throw new Error("CDP target does not expose a WebSocket URL");
  }
  if (typeof WebSocketImpl !== "function") {
    throw new Error("WebSocket implementation is unavailable; WebView CDP was not executed");
  }

  const socket = new WebSocketImpl(webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  let opened = false;

  const waitForOpen = new Promise((resolve, reject) => {
    const onOpen = () => {
      opened = true;
      resolve();
    };
    const onError = () => reject(new Error("CDP WebSocket could not be opened"));
    if (typeof socket.addEventListener === "function") {
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    } else {
      socket.onopen = onOpen;
      socket.onerror = onError;
    }
  });

  const handleMessage = (event) => {
    let message;
    try {
      message = JSON.parse(eventDataToText(event?.data ?? event));
    } catch {
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`CDP command failed: ${message.error.message || "unknown error"}`));
    else request.resolve(message.result ?? {});
  };
  if (typeof socket.addEventListener === "function") socket.addEventListener("message", handleMessage);
  else socket.onmessage = handleMessage;

  await waitForOpen;
  return {
    async send(method, params = {}) {
      if (!opened) throw new Error("CDP WebSocket is not open");
      const id = nextId++;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      for (const request of pending.values()) request.reject(new Error("CDP WebSocket closed"));
      pending.clear();
      socket.close();
    },
  };
}

export async function collectWebViewMetricsFromEndpoint({
  packageName,
  pid,
  process,
  endpoint,
  fetchJson = defaultFetchJson,
  connect = connectCdpTarget,
}) {
  assertWebViewProcess({ packageName, pid, process });
  const normalizedEndpoint = normalizeEndpoint(endpoint);
  const targets = normalizeCdpTargetsForEndpoint(await fetchJson(`${normalizedEndpoint}/json/list`), normalizedEndpoint);
  if (targets.length !== 1) {
    throw new Error(`Expected exactly one debuggable WebView page; found ${targets.length}`);
  }
  const session = await connect({ webSocketDebuggerUrl: targets[0].webSocketDebuggerUrl });
  try {
    return await collectWebViewMetrics({ packageName, pid, process, session });
  } finally {
    session.close?.();
  }
}
