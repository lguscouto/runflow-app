import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveAndroidTool } from "./adb-screenshot.mjs";

export const NAVIGATION_MODES = Object.freeze({
  "three-buttons": 0,
  "two-buttons": 1,
  gesture: 2,
});

const SIZE_PATTERN = /^\d+x\d+$/;
const INTEGER_PATTERN = /^-?\d+$/;
const FONT_SCALE_PATTERN = /^\d+(?:\.\d+)?$/;

function text(value) {
  return String(value ?? "").replaceAll("\r", "").trim();
}

function commandFailure(error, executable, args) {
  const stderr = error?.stderr ? String(error.stderr).trim() : "";
  const stdout = error?.stdout ? String(error.stdout).trim() : "";
  const detail = stderr || stdout || error?.message || "unknown child-process error";
  return new Error(`Command failed: ${executable} ${args.join(" ")}\n${detail}`);
}

export function createAdbRunner({ adbPath = "adb", serial, execFile = execFileSync } = {}) {
  if (!serial || typeof serial !== "string") throw new Error("ADB serial is required.");
  return (args) => {
    if (!Array.isArray(args) || args.length === 0) throw new Error("ADB command arguments are required.");
    const fullArgs = ["-s", serial, ...args];
    try {
      return text(
        execFile(adbPath, fullArgs, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        }),
      );
    } catch (error) {
      throw commandFailure(error, adbPath, fullArgs);
    }
  };
}

function parseSizeOutput(output, label) {
  const match = text(output).match(new RegExp(`(?:^|\\n)\\s*${label} size:\\s*(\\d+x\\d+)`, "i"));
  if (!match || !SIZE_PATTERN.test(match[1])) throw new Error(`ADB did not report ${label.toLowerCase()} size.`);
  return match[1];
}

export function parseWmSize(output) {
  const physical = parseSizeOutput(output, "Physical");
  const overrideMatch = text(output).match(/(?:^|\n)\s*Override size:\s*(\d+x\d+)/i);
  return {
    physical,
    override: overrideMatch && SIZE_PATTERN.test(overrideMatch[1]) ? overrideMatch[1] : null,
  };
}

export function parseWmDensity(output) {
  const physicalMatch = text(output).match(/(?:^|\n)\s*Physical density:\s*(\d+)/i);
  if (!physicalMatch) throw new Error("ADB did not report physical density.");
  const overrideMatch = text(output).match(/(?:^|\n)\s*Override density:\s*(\d+)/i);
  return {
    physical: Number(physicalMatch[1]),
    override: overrideMatch ? Number(overrideMatch[1]) : null,
  };
}

export function parseSetting(output, { name, allowNull = false, pattern = INTEGER_PATTERN } = {}) {
  const value = text(output);
  if (value === "null" || value === "none" || value === "") {
    if (allowNull) return null;
    throw new Error(`ADB did not report setting ${name ?? "<unnamed>"}.`);
  }
  if (!pattern.test(value)) throw new Error(`Invalid ADB value for ${name ?? "<unnamed>"}: ${value}`);
  return value;
}

function normalizeFontScale(value) {
  if (value === null || value === undefined || value === "null") return null;
  const stringValue = String(value).trim();
  if (!FONT_SCALE_PATTERN.test(stringValue)) throw new Error(`Invalid font scale: ${value}`);
  const numericValue = Number(stringValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > 4) {
    throw new Error(`Font scale must be greater than 0 and no greater than 4: ${value}`);
  }
  return stringValue;
}

function assertSize(value, label) {
  if (value !== null && (!value || !SIZE_PATTERN.test(value))) {
    throw new Error(`${label} must be a WIDTHxHEIGHT string or null.`);
  }
}

function assertInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
}

export function validateDeviceState(state) {
  if (!state || typeof state !== "object") throw new Error("Device state must be an object.");
  if (state.schemaVersion !== 1) throw new Error("Unsupported device state schema; expected version 1.");
  if (!state.size || !state.density || !state.rotation || !state.navigation) {
    throw new Error("Device state is missing size, density, rotation, or navigation.");
  }
  assertSize(state.size.physical, "Physical size");
  assertSize(state.size.override, "Override size");
  if (!Number.isInteger(state.density.physical) || state.density.physical <= 0) {
    throw new Error("Physical density must be a positive integer.");
  }
  if (state.density.override !== null && (!Number.isInteger(state.density.override) || state.density.override <= 0)) {
    throw new Error("Override density must be a positive integer or null.");
  }
  normalizeFontScale(state.fontScale);
  assertInteger(state.rotation.accelerometerRotation, "Accelerometer rotation", 0, 1);
  assertInteger(state.rotation.userRotation, "User rotation", 0, 3);
  assertInteger(state.navigation.mode, "Navigation mode", 0, 2);
  return state;
}

export function captureDeviceState({ adbPath = "adb", serial, runAdb, capturedAt = new Date().toISOString() } = {}) {
  if (!serial || typeof serial !== "string") throw new Error("ADB serial is required.");
  const execute = runAdb || createAdbRunner({ adbPath, serial });
  const state = {
    schemaVersion: 1,
    serial,
    capturedAt,
    size: parseWmSize(execute(["shell", "wm", "size"])),
    density: parseWmDensity(execute(["shell", "wm", "density"])),
    fontScale: normalizeFontScale(
      parseSetting(execute(["shell", "settings", "get", "system", "font_scale"]), {
        name: "font_scale",
        allowNull: true,
        pattern: FONT_SCALE_PATTERN,
      }),
    ),
    rotation: {
      accelerometerRotation: Number(
        parseSetting(execute(["shell", "settings", "get", "system", "accelerometer_rotation"]), {
          name: "accelerometer_rotation",
        }),
      ),
      userRotation: Number(
        parseSetting(execute(["shell", "settings", "get", "system", "user_rotation"]), {
          name: "user_rotation",
        }),
      ),
    },
    navigation: {
      mode: Number(
        parseSetting(execute(["shell", "settings", "get", "secure", "navigation_mode"]), {
          name: "navigation_mode",
        }),
      ),
    },
  };
  validateDeviceState(state);
  return state;
}

export function buildRestoreCommands(state) {
  validateDeviceState(state);
  return [
    {
      label: "size",
      args: ["shell", "wm", "size", state.size.override ?? "reset"],
    },
    {
      label: "density",
      args: ["shell", "wm", "density", state.density.override === null ? "reset" : String(state.density.override)],
    },
    {
      label: "font-scale",
      args:
        state.fontScale === null
          ? ["shell", "settings", "delete", "system", "font_scale"]
          : ["shell", "settings", "put", "system", "font_scale", state.fontScale],
    },
    {
      label: "rotation-mode",
      args:
        state.rotation.accelerometerRotation === 0
          ? ["shell", "wm", "user-rotation", "lock", String(state.rotation.userRotation)]
          : ["shell", "wm", "user-rotation", "free"],
    },
    {
      label: "rotation-disable-auto",
      args: ["shell", "settings", "put", "system", "accelerometer_rotation", "0"],
    },
    {
      label: "rotation-user",
      args: ["shell", "settings", "put", "system", "user_rotation", String(state.rotation.userRotation)],
    },
    {
      label: "rotation-restore-auto",
      args: [
        "shell",
        "settings",
        "put",
        "system",
        "accelerometer_rotation",
        String(state.rotation.accelerometerRotation),
      ],
    },
    {
      label: "navigation",
      args: ["shell", "settings", "put", "secure", "navigation_mode", String(state.navigation.mode)],
    },
  ];
}

function sameNullableNumber(left, right) {
  if (left === null || right === null) return left === right;
  return Number(left) === Number(right);
}

export function statesMatch(expected, observed) {
  validateDeviceState(expected);
  validateDeviceState(observed);
  return (
    expected.size.physical === observed.size.physical &&
    expected.size.override === observed.size.override &&
    expected.density.physical === observed.density.physical &&
    sameNullableNumber(expected.density.override, observed.density.override) &&
    sameNullableNumber(expected.fontScale, observed.fontScale) &&
    expected.rotation.accelerometerRotation === observed.rotation.accelerometerRotation &&
    expected.rotation.userRotation === observed.rotation.userRotation &&
    expected.navigation.mode === observed.navigation.mode
  );
}

export function restoreDeviceState({ adbPath = "adb", serial, state, runAdb } = {}) {
  if (!serial || typeof serial !== "string") throw new Error("ADB serial is required for restoration.");
  validateDeviceState(state);
  const execute = runAdb || createAdbRunner({ adbPath, serial });
  const failures = [];
  for (const command of buildRestoreCommands(state)) {
    try {
      execute(command.args);
    } catch (error) {
      failures.push(`${command.label}: ${error.message}`);
    }
  }

  let observed;
  try {
    observed = captureDeviceState({ serial, runAdb: execute });
  } catch (error) {
    failures.push(`verification: ${error.message}`);
  }
  if (observed && !statesMatch(state, observed)) {
    failures.push("verification: restored device state differs from the captured state");
  }
  if (failures.length > 0) {
    throw new Error(`Device state restoration failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }
  return { commands: buildRestoreCommands(state), observed };
}

function parseArgs(argv) {
  const options = { dryRun: false };
  const valueOptions = new Set(["--serial", "--state-file", "--state-json"]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
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
    options[flag.slice(2).replaceAll("-", "_")] = value;
  }
  return options;
}

function sampleState(serial) {
  return {
    schemaVersion: 1,
    serial,
    capturedAt: null,
    size: { physical: "1080x1920", override: null },
    density: { physical: 420, override: null },
    fontScale: "1.0",
    rotation: { accelerometerRotation: 1, userRotation: 0 },
    navigation: { mode: NAVIGATION_MODES.gesture },
  };
}

function loadState(options) {
  if (options.state_file) return JSON.parse(fs.readFileSync(path.resolve(options.state_file), "utf8"));
  if (options.state_json) return JSON.parse(options.state_json);
  return null;
}

function printHelp() {
  console.log(
    "Usage: node scripts/android/reset-device-state.mjs --serial SERIAL --state-file FILE\n\n" +
      "Restores state captured by run-visual-matrix.mjs. --dry-run never invokes adb and may use a sample state.",
  );
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const serial = options.serial || (options.dryRun ? "emulator-DRYRUN" : undefined);
  if (!serial) throw new Error("--serial is required outside --dry-run.");
  const loaded = loadState(options);
  const rawState = loaded?.state && !loaded.size ? loaded.state : loaded;
  const state = rawState || sampleState(serial);
  validateDeviceState(state);
  if (state.serial && state.serial !== serial) {
    throw new Error(`State serial ${state.serial} does not match requested serial ${serial}.`);
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          adbInvoked: false,
          serial,
          sampleState: !rawState,
          commands: buildRestoreCommands(state).map((command) => ({ label: command.label, args: command.args })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const adbPath = resolveAndroidTool("adb");
  const result = restoreDeviceState({ adbPath, serial, state });
  console.log(JSON.stringify({ mode: "restore", adbPath, serial, observed: result.observed }, null, 2));
}

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (modulePath.toLowerCase() === invokedPath.toLowerCase()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
