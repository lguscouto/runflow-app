import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertOutputOutsideRepository,
  buildScreenshotCommand,
  captureScreenshot,
  resolveAndroidTool,
  resolveRepositoryRoot,
} from "./adb-screenshot.mjs";
import {
  NAVIGATION_MODES,
  buildRestoreCommands,
  captureDeviceState,
  createAdbRunner,
  restoreDeviceState,
} from "./reset-device-state.mjs";

const DEFAULT_CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "avd-matrix.json");
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SIZE_PATTERN = /^(\d+)x(\d+)$/;

function commandFailure(error, executable, args) {
  const stderr = error?.stderr ? String(error.stderr).trim() : "";
  const stdout = error?.stdout ? String(error.stdout).trim() : "";
  const detail = stderr || stdout || error?.message || "unknown child-process error";
  return new Error(`Command failed: ${executable} ${args.join(" ")}\n${detail}`);
}

function runExecutable(executable, args) {
  try {
    return String(
      execFileSync(executable, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }),
    ).replaceAll("\r", "").trim();
  } catch (error) {
    throw commandFailure(error, executable, args);
  }
}

function finiteNumber(value, label, { integer = false, minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number)) || number < minimum || number > maximum) {
    throw new Error(`${label} must be a number between ${minimum} and ${maximum}${integer ? " and an integer" : ""}.`);
  }
  return number;
}

function normalizeCase(rawCase, index = 0) {
  if (!rawCase || typeof rawCase !== "object") throw new Error(`Matrix case ${index + 1} must be an object.`);
  const id = String(rawCase.id ?? "").trim();
  if (!ID_PATTERN.test(id)) throw new Error(`Matrix case ${index + 1} has an unsafe or missing id.`);
  const size = String(rawCase.size ?? "").trim();
  const sizeMatch = size.match(SIZE_PATTERN);
  if (!sizeMatch || Number(sizeMatch[1]) <= 0 || Number(sizeMatch[2]) <= 0) {
    throw new Error(`Matrix case ${id} must use a positive WIDTHxHEIGHT size.`);
  }
  const density = finiteNumber(rawCase.density, `Density for ${id}`, {
    integer: true,
    minimum: 80,
    maximum: 1000,
  });
  const fontScale = finiteNumber(rawCase.fontScale, `Font scale for ${id}`, {
    minimum: 0.1,
    maximum: 4,
  });
  const rotation = finiteNumber(rawCase.rotation, `Rotation for ${id}`, {
    integer: true,
    minimum: 0,
    maximum: 3,
  });
  const navigation = rawCase.navigation ?? rawCase.navigationMode;
  if (typeof navigation !== "string" || !(navigation in NAVIGATION_MODES)) {
    throw new Error(
      `Navigation for ${id} must be one of: ${Object.keys(NAVIGATION_MODES).join(", ")}.`,
    );
  }
  return {
    ...rawCase,
    id,
    label: String(rawCase.label ?? id),
    size,
    density,
    fontScale,
    rotation,
    navigation,
  };
}

export function validateMatrixConfig(config) {
  if (!config || typeof config !== "object") throw new Error("Visual matrix config must be a JSON object.");
  if (config.schemaVersion !== 1) throw new Error("Visual matrix config must use schemaVersion 1.");
  if (!config.app || typeof config.app !== "object") throw new Error("Visual matrix config is missing app settings.");
  const packageName = String(config.app.package ?? "").trim();
  const activity = String(config.app.activity ?? "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(packageName)) throw new Error("app.package is not a valid Android package name.");
  if (!activity || !activity.includes("/")) throw new Error("app.activity must be an Android component (package/activity).");
  const settleMs = finiteNumber(config.app.settleMs ?? 1000, "app.settleMs", {
    integer: true,
    minimum: 0,
    maximum: 60000,
  });
  if (!Array.isArray(config.matrix) || config.matrix.length === 0) {
    throw new Error("Visual matrix must contain at least one case.");
  }
  const cases = config.matrix.map((rawCase, index) => normalizeCase(rawCase, index));
  const ids = new Set();
  for (const matrixCase of cases) {
    if (ids.has(matrixCase.id)) throw new Error(`Duplicate matrix case id: ${matrixCase.id}`);
    ids.add(matrixCase.id);
  }
  const avd = config.avd && typeof config.avd === "object" ? config.avd : {};
  if (avd.requireVisible !== undefined && typeof avd.requireVisible !== "boolean") {
    throw new Error("avd.requireVisible must be boolean when provided.");
  }
  return {
    ...config,
    avd: { ...avd, requireVisible: avd.requireVisible !== false },
    app: {
      ...config.app,
      package: packageName,
      activity,
      launchEachCase: config.app.launchEachCase !== false,
      settleMs,
    },
    matrix: cases,
  };
}

function deviceOverrideSize(normalized) {
  const [width, height] = normalized.size.split("x").map(Number);
  return normalized.rotation % 2 === 1 ? `${height}x${width}` : `${width}x${height}`;
}

export function buildApplyCommands(matrixCase) {
  const normalized = normalizeCase(matrixCase);
  return [
    {
      label: "size",
      args: ["shell", "wm", "size", deviceOverrideSize(normalized)],
    },
    {
      label: "density",
      args: ["shell", "wm", "density", String(normalized.density)],
    },
    {
      label: "font-scale",
      args: ["shell", "settings", "put", "system", "font_scale", String(normalized.fontScale)],
    },
    {
      label: "rotation-disable-auto",
      args: ["shell", "settings", "put", "system", "accelerometer_rotation", "0"],
    },
    {
      label: "rotation",
      args: ["shell", "wm", "user-rotation", "lock", String(normalized.rotation)],
    },
    {
      label: "navigation",
      args: ["shell", "settings", "put", "secure", "navigation_mode", String(NAVIGATION_MODES[normalized.navigation])],
    },
  ];
}

export function buildPostLaunchCommands(matrixCase) {
  const normalized = normalizeCase(matrixCase);
  return [
    {
      label: "rotation-post-launch",
      args: ["shell", "wm", "user-rotation", "lock", String(normalized.rotation)],
    },
  ];
}

export function assertCaseApplied(matrixCase, state) {
  const normalized = normalizeCase(matrixCase);
  if (state.size.override !== deviceOverrideSize(normalized)) {
    throw new Error(`Applied size mismatch for ${normalized.id}.`);
  }
  const effectiveDensity = state.density.override ?? state.density.physical;
  if (effectiveDensity !== normalized.density) throw new Error(`Applied density mismatch for ${normalized.id}.`);
  if (Number(state.fontScale) !== normalized.fontScale) throw new Error(`Applied font scale mismatch for ${normalized.id}.`);
  if (state.rotation.userRotation !== normalized.rotation) throw new Error(`Applied rotation mismatch for ${normalized.id}.`);
  if (state.navigation.mode !== NAVIGATION_MODES[normalized.navigation]) {
    throw new Error(`Applied navigation mismatch for ${normalized.id}.`);
  }
  return true;
}

export function parseAdbDevices(output) {
  return String(output ?? "")
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices attached") && !line.startsWith("*"))
    .map((line) => {
      const fields = line.split(/\s+/);
      return { serial: fields[0], state: fields[1] || "", details: fields.slice(2).join(" ") };
    })
    .filter((entry) => entry.serial && entry.state);
}

export function assertScreenshotDimensions(matrixCase, dimensions) {
  const normalized = normalizeCase(matrixCase);
  const [expectedWidth, expectedHeight] = normalized.size.split("x").map(Number);
  if (
    !dimensions ||
    dimensions.width !== expectedWidth ||
    dimensions.height !== expectedHeight
  ) {
    const actual = dimensions ? `${dimensions.width}x${dimensions.height}` : "unknown";
    throw new Error(
      `Screenshot dimensions mismatch for ${normalized.id}: expected ${normalized.size}, got ${actual}.`,
    );
  }
  return true;
}

function parseAvdList(output) {
  return String(output ?? "")
    .replaceAll("\r", "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAvdName(output) {
  const text = String(output ?? "").replaceAll("\r", "");
  const quoted = text.match(/Android Virtual Device\s+"([^"]+)"/i);
  if (quoted) return quoted[1];
  const line = text
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value && !/^OK$/i.test(value) && !/^Android Emulator/i.test(value) && !/^unknown/i.test(value));
  return line || null;
}

function readRequiredProp(runAdb, property) {
  const value = runAdb(["shell", "getprop", property]).trim();
  if (!value) throw new Error(`Device property ${property} is empty.`);
  return value;
}

function queryAvdName(runAdb) {
  try {
    const name = parseAvdName(runAdb(["emu", "avd", "name"]));
    if (name) return name;
  } catch {
    // Some emulator builds do not expose `emu avd name`; use the boot property below.
  }
  try {
    const property = runAdb(["shell", "getprop", "ro.boot.qemu.avd_name"]).trim();
    return property || null;
  } catch {
    return null;
  }
}

export function validateAvdAndDevice({ adbPath, emulatorPath, requestedAvd, requestedSerial }) {
  const availableAvds = parseAvdList(runExecutable(emulatorPath, ["-list-avds"]));
  if (availableAvds.length === 0) {
    throw new Error("No AVD is registered. This script never creates or starts an emulator.");
  }
  const deviceRows = parseAdbDevices(runExecutable(adbPath, ["devices", "-l"]));
  let device;
  if (requestedSerial) {
    device = deviceRows.find((entry) => entry.serial === requestedSerial);
    if (!device) throw new Error(`Requested ADB serial is not listed: ${requestedSerial}.`);
    if (device.state !== "device") throw new Error(`Requested ADB serial is not ready: ${requestedSerial} (${device.state}).`);
  } else {
    const candidates = deviceRows.filter((entry) => entry.state === "device" && entry.serial.startsWith("emulator-"));
    if (candidates.length !== 1) {
      throw new Error(
        `Expected exactly one ready emulator; found ${candidates.length}. Pass --serial explicitly and ensure no device is offline/unauthorized.`,
      );
    }
    device = candidates[0];
  }

  const runAdb = createAdbRunner({ adbPath, serial: device.serial });
  if (runAdb(["get-state"]) !== "device") throw new Error(`ADB state is not device for ${device.serial}.`);
  if (readRequiredProp(runAdb, "ro.kernel.qemu") !== "1") {
    throw new Error(`Serial ${device.serial} is not identified as an emulator; refusing to alter a physical device.`);
  }
  const sdk = Number(readRequiredProp(runAdb, "ro.build.version.sdk"));
  if (!Number.isInteger(sdk) || sdk < 1) throw new Error(`Invalid Android API level reported by ${device.serial}.`);
  const avdName = queryAvdName(runAdb);
  if (!avdName) throw new Error(`Could not identify the AVD backing ${device.serial}; refusing to change device state.`);
  if (requestedAvd && avdName !== requestedAvd) {
    throw new Error(`Connected AVD ${avdName} does not match requested AVD ${requestedAvd}.`);
  }
  if (!availableAvds.includes(avdName)) {
    throw new Error(`Connected AVD ${avdName} is not returned by emulator -list-avds.`);
  }
  return {
    serial: device.serial,
    avdName,
    sdk,
    model: readRequiredProp(runAdb, "ro.product.model"),
    manufacturer: readRequiredProp(runAdb, "ro.product.manufacturer"),
    release: readRequiredProp(runAdb, "ro.build.version.release"),
    availableAvds,
    deviceRows,
    runAdb,
  };
}

function ensureInstalled(runAdb, packageName) {
  const result = runAdb(["shell", "pm", "path", packageName]);
  if (!result.includes("package:")) throw new Error(`Package is not installed on the selected AVD: ${packageName}.`);
}

function validateAppComponent(app) {
  if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(app.package)) {
    throw new Error(`Invalid Android package override: ${app.package}`);
  }
  if (!app.activity || !app.activity.includes("/")) {
    throw new Error(`Invalid Android activity override: ${app.activity}`);
  }
}

function launchApp(runAdb, packageName, activity) {
  runAdb(["shell", "am", "force-stop", packageName]);
  const result = runAdb(["shell", "am", "start", "-W", "-n", activity]);
  if (/Error type|Exception|START_NOT_FOUND|does not exist/i.test(result)) {
    throw new Error(`Android activity did not start: ${activity}\n${result}`);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function prepareOutputDirectory(requested, dryRun, repositoryRoot) {
  const outputDirectory = requested
    ? path.resolve(requested)
    : dryRun
      ? path.join(os.tmpdir(), "runflow-visual-matrix-dry-run")
      : fs.mkdtempSync(path.join(os.tmpdir(), "runflow-visual-matrix-"));
  const safeDirectory = assertOutputOutsideRepository(outputDirectory, repositoryRoot);
  if (dryRun) return safeDirectory;
  if (fs.existsSync(safeDirectory)) {
    if (!fs.statSync(safeDirectory).isDirectory()) throw new Error(`Output path is not a directory: ${safeDirectory}`);
    if (fs.readdirSync(safeDirectory).length > 0) {
      throw new Error(`Output directory must be empty to avoid overwriting captures: ${safeDirectory}`);
    }
  } else {
    fs.mkdirSync(safeDirectory, { recursive: true });
  }
  return safeDirectory;
}

function selectCases(config, requestedIds) {
  if (!requestedIds || requestedIds.length === 0) return config.matrix;
  const requested = new Set(requestedIds);
  const selected = config.matrix.filter((matrixCase) => requested.has(matrixCase.id));
  const missing = requestedIds.filter((id) => !config.matrix.some((matrixCase) => matrixCase.id === id));
  if (missing.length > 0) throw new Error(`Unknown matrix case(s): ${missing.join(", ")}`);
  return selected;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const options = { dryRun: false, skipLaunch: false, cases: [] };
  const valueOptions = new Set([
    "--config",
    "--avd",
    "--serial",
    "--output",
    "--package",
    "--activity",
    "--case",
    "--settle-ms",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--visible") {
      options.visible = true;
      continue;
    }
    if (argument === "--skip-launch" || argument === "--no-launch") {
      options.skipLaunch = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    const equalsIndex = argument.indexOf("=");
    const flag = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument;
    let value = equalsIndex >= 0 ? argument.slice(equalsIndex + 1) : undefined;
    if (!valueOptions.has(flag)) throw new Error(`Unknown argument: ${argument}`);
    if (value === undefined) {
      value = argv[index + 1];
      index += 1;
    }
    if (!value) throw new Error(`Missing value for ${flag}.`);
    const key = flag.slice(2).replaceAll("-", "_");
    if (key === "case") options.cases.push(value);
    else options[key] = value;
  }
  if (options.settle_ms !== undefined) {
    options.settle_ms = finiteNumber(options.settle_ms, "--settle-ms", {
      integer: true,
      minimum: 0,
      maximum: 60000,
    });
  }
  return options;
}

function buildDryRunPlan({ configPath, config, cases, options, outputDirectory }) {
  const serial = options.serial || "emulator-DRYRUN";
  const adbPath = "adb";
  const app = {
    ...config.app,
    package: options.package || config.app.package,
    activity: options.activity || config.app.activity,
  };
  validateAppComponent(app);
  const commands = [];
  for (const matrixCase of cases) {
    for (const command of buildApplyCommands(matrixCase)) commands.push({ case: matrixCase.id, ...command });
    if (!options.skipLaunch && app.launchEachCase) {
      commands.push({ case: matrixCase.id, label: "force-stop", args: ["shell", "am", "force-stop", app.package] });
      commands.push({ case: matrixCase.id, label: "start", args: ["shell", "am", "start", "-W", "-n", app.activity] });
    }
    for (const command of buildPostLaunchCommands(matrixCase)) {
      commands.push({ case: matrixCase.id, ...command });
    }
    commands.push({
      case: matrixCase.id,
      label: "screenshot",
      args: buildScreenshotCommand({ adbPath, serial }),
      output: path.join(outputDirectory, `${matrixCase.id}.png`),
    });
  }
  return {
    mode: "dry-run",
    adbInvoked: false,
    emulatorInvoked: false,
    configPath,
    avd: options.avd || null,
    serial,
    visibleAssertion: options.visible === true,
    outputDirectory,
    cases: cases.map((matrixCase) => matrixCase.id),
    commands,
    restoration: buildRestoreCommands({
      schemaVersion: 1,
      serial,
      capturedAt: null,
      size: { physical: "1080x1920", override: null },
      density: { physical: 420, override: null },
      fontScale: "1.0",
      rotation: { accelerometerRotation: 1, userRotation: 0 },
      navigation: { mode: NAVIGATION_MODES.gesture },
    }),
    note: "Plan only: no SDK lookup, ADB command, emulator launch, screenshot, or file write was performed.",
  };
}

function installSignalFlag() {
  let requested = false;
  const handler = () => {
    requested = true;
    console.error("Stop requested; the current case will finish its command and device state will be restored.");
  };
  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);
  return {
    get requested() {
      return requested;
    },
    remove() {
      process.removeListener("SIGINT", handler);
      process.removeListener("SIGTERM", handler);
    },
  };
}

export async function runVisualMatrix(options = {}) {
  const dryRun = options.dryRun === true;
  const configPath = path.resolve(options.config || DEFAULT_CONFIG_PATH);
  const config = validateMatrixConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
  const cases = selectCases(config, options.cases || []);
  const repositoryRoot = resolveRepositoryRoot(process.cwd());
  const outputDirectory = prepareOutputDirectory(options.output, dryRun, repositoryRoot);
  if (dryRun) {
    const plan = buildDryRunPlan({ configPath, config, cases, options, outputDirectory });
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }
  if (config.avd.requireVisible && options.visible !== true) {
    throw new Error(
      "This matrix requires a visibly launched AVD. Start it manually (without -no-window), verify the window, then pass --visible. This script will not start an emulator.",
    );
  }

  const adbPath = resolveAndroidTool("adb");
  const emulatorPath = resolveAndroidTool("emulator");
  const validation = validateAvdAndDevice({
    adbPath,
    emulatorPath,
    requestedAvd: options.avd,
    requestedSerial: options.serial,
  });
  const serial = validation.serial;
  const runAdb = validation.runAdb;
  const app = {
    ...config.app,
    package: options.package || config.app.package,
    activity: options.activity || config.app.activity,
  };
  validateAppComponent(app);
  const shouldLaunch = !options.skipLaunch && app.launchEachCase;
  if (shouldLaunch) ensureInstalled(runAdb, app.package);

  const report = {
    schemaVersion: 1,
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: null,
    configPath,
    outputDirectory,
    avd: validation.avdName,
    serial,
    visibleAssertion: true,
    app,
    device: {
      sdk: validation.sdk,
      model: validation.model,
      manufacturer: validation.manufacturer,
      release: validation.release,
    },
    cases: [],
    restoration: { status: "pending", stateFile: path.join(outputDirectory, "device-state.json") },
  };
  const reportPath = path.join(outputDirectory, "run.json");
  const statePath = path.join(outputDirectory, "device-state.json");
  writeJson(reportPath, report);

  let originalState = null;
  let primaryError = null;
  let restorationError = null;
  let reportError = null;
  const signal = installSignalFlag();
  try {
    originalState = captureDeviceState({ adbPath, serial, runAdb });
    writeJson(statePath, originalState);
    report.originalState = originalState;
    writeJson(reportPath, report);

    for (const matrixCase of cases) {
      if (signal.requested) throw new Error("Matrix interrupted by operator.");
      for (const command of buildApplyCommands(matrixCase)) runAdb(command.args);
      const appliedState = captureDeviceState({ serial, runAdb });
      assertCaseApplied(matrixCase, appliedState);
      if (shouldLaunch) launchApp(runAdb, app.package, app.activity);
      for (const command of buildPostLaunchCommands(matrixCase)) runAdb(command.args);
      const settleMs = options.settle_ms ?? app.settleMs;
      if (settleMs > 0) await sleep(settleMs);
      const capture = captureScreenshot({
        adbPath,
        serial,
        outputDirectory,
        name: matrixCase.id,
        repositoryRoot,
        metadata: {
          caseId: matrixCase.id,
          label: matrixCase.label,
          requestedState: {
            size: matrixCase.size,
            density: matrixCase.density,
            fontScale: matrixCase.fontScale,
            rotation: matrixCase.rotation,
            navigation: matrixCase.navigation,
          },
          appliedState,
          device: {
            avd: validation.avdName,
            sdk: validation.sdk,
            model: validation.model,
            release: validation.release,
          },
        },
      });
      assertScreenshotDimensions(matrixCase, capture.dimensions);
      report.cases.push({
        id: matrixCase.id,
        label: matrixCase.label,
        screenshot: capture.screenshotPath,
        metadata: capture.metadataPath,
        bytes: capture.bytes,
      });
      writeJson(reportPath, report);
    }
  } catch (error) {
    primaryError = error;
    report.error = formatError(error);
  } finally {
    if (originalState) {
      try {
        const restoration = restoreDeviceState({ adbPath, serial, state: originalState, runAdb });
        report.restoration = {
          status: "restored",
          stateFile: statePath,
          restoredAt: new Date().toISOString(),
          verification: restoration.observed,
        };
      } catch (error) {
        restorationError = error;
        report.restoration = {
          status: "failed",
          stateFile: statePath,
          error: formatError(error),
        };
      }
    } else {
      report.restoration = { status: "not-needed", stateFile: statePath };
    }
    report.status = primaryError || restorationError ? "failed" : "completed";
    report.completedAt = new Date().toISOString();
    try {
      writeJson(reportPath, report);
    } catch (error) {
      reportError = error;
    }
    signal.remove();
  }

  if (reportError) {
    const message = `Could not write run metadata: ${formatError(reportError)}`;
    if (primaryError) primaryError = new Error(`${formatError(primaryError)}\n${message}`);
    else primaryError = reportError;
  }
  if (primaryError || restorationError) {
    const messages = [];
    if (primaryError) messages.push(`matrix: ${formatError(primaryError)}`);
    if (restorationError) messages.push(`restoration: ${formatError(restorationError)}`);
    throw new Error(messages.join("\n"));
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}

function printHelp() {
  console.log(
    "Usage: node scripts/android/run-visual-matrix.mjs [options]\n\n" +
      "Real mode requires a manually started visible AVD and --visible. It never invokes emulator -avd.\n" +
      "Options: --config FILE --avd NAME --serial SERIAL --output DIR --package PKG --activity COMPONENT\n" +
      "         --case ID (repeatable) --settle-ms N --skip-launch --visible --dry-run",
  );
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  await runVisualMatrix(options);
}

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (modulePath.toLowerCase() === invokedPath.toLowerCase()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
