import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function normalizeWindowsPath(value) {
  const text = String(value ?? "").trim();
  if (process.platform !== "win32") return text;
  const msysDrive = text.match(/^\/([a-zA-Z])\/(.*)$/);
  if (msysDrive) return `${msysDrive[1].toUpperCase()}:\\${msysDrive[2].replaceAll("/", "\\")}`;
  return text.replaceAll("/", "\\");
}

export function resolveSdkRoot(env = process.env) {
  const configured = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT].find(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (configured) return path.resolve(normalizeWindowsPath(configured));

  if (process.platform === "win32") {
    const localAppData = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.resolve(normalizeWindowsPath(localAppData), "Android", "Sdk");
  }
  if (process.platform === "darwin") return path.resolve(os.homedir(), "Library", "Android", "sdk");
  return path.resolve(os.homedir(), "Android", "Sdk");
}

export function resolveAndroidTool(tool, env = process.env) {
  if (tool !== "adb" && tool !== "emulator") {
    throw new Error(`Unsupported Android SDK tool: ${tool}`);
  }
  const executable = process.platform === "win32" ? `${tool}.exe` : tool;
  const directory = tool === "adb" ? "platform-tools" : "emulator";
  const toolPath = path.join(resolveSdkRoot(env), directory, executable);
  if (!fs.existsSync(toolPath)) {
    throw new Error(
      `Android SDK tool not found: ${toolPath}. Set ANDROID_HOME or ANDROID_SDK_ROOT to a valid SDK.`,
    );
  }
  return toolPath;
}

function normalizeForComparison(value) {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isPathInside(parent, candidate) {
  const root = normalizeForComparison(parent);
  const target = normalizeForComparison(candidate);
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function resolveRepositoryRoot(startDirectory = process.cwd()) {
  const start = path.resolve(startDirectory);
  try {
    const result = execFileSync("git", ["-C", start, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const root = String(result).trim();
    if (root) return path.resolve(normalizeWindowsPath(root));
  } catch {
    // A standalone copy may not be inside Git; the caller still gets a safe cwd guard.
  }
  return start;
}

export function assertOutputOutsideRepository(outputDirectory, repositoryRoot = resolveRepositoryRoot()) {
  const absoluteOutput = path.resolve(normalizeWindowsPath(outputDirectory));
  const absoluteRepository = path.resolve(normalizeWindowsPath(repositoryRoot));
  if (isPathInside(absoluteRepository, absoluteOutput)) {
    throw new Error(
      `Refusing to write visual artifacts inside the repository: ${absoluteOutput}. ` +
        "Use a directory outside the checkout, such as %LOCALAPPDATA%/Temp.",
    );
  }
  return absoluteOutput;
}

function normalizeScreenshotStem(name) {
  const raw = String(name ?? "").trim();
  const withoutExtension = raw.toLowerCase().endsWith(".png") ? raw.slice(0, -4) : raw;
  if (!withoutExtension || withoutExtension === "." || withoutExtension === "..") {
    throw new Error("Screenshot name must be non-empty.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(withoutExtension)) {
    throw new Error(`Unsafe screenshot name: ${name}`);
  }
  return withoutExtension;
}

export function buildScreenshotCommand({ adbPath = "adb", serial }) {
  if (!serial || typeof serial !== "string") throw new Error("ADB serial is required.");
  return ["-s", serial, "exec-out", "screencap", "-p"];
}

function childProcessFailure(error, executable, args) {
  const stderr = error?.stderr ? String(error.stderr).trim() : "";
  const stdout = error?.stdout ? String(error.stdout).trim() : "";
  const detail = stderr || stdout || error?.message || "unknown child-process error";
  return new Error(`Command failed: ${executable} ${args.join(" ")}\n${detail}`);
}

function writeJsonExclusive(filePath, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, content, { encoding: "utf8", flag: "wx" });
}

export function isPng(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.equals(buffer.subarray(0, PNG_SIGNATURE.length));
}

export function parsePngDimensions(buffer) {
  if (!isPng(buffer) || buffer.length < 24) {
    throw new Error("PNG buffer is too small or has an invalid signature.");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) throw new Error("PNG dimensions must be positive.");
  return { width, height };
}

export function captureScreenshot({
  adbPath = "adb",
  serial,
  outputDirectory,
  name,
  metadata = {},
  dryRun = false,
  repositoryRoot,
  now = () => new Date().toISOString(),
}) {
  if (!outputDirectory) throw new Error("Screenshot output directory is required.");
  const safeDirectory = assertOutputOutsideRepository(outputDirectory, repositoryRoot);
  const stem = normalizeScreenshotStem(name);
  const screenshotPath = path.join(safeDirectory, `${stem}.png`);
  const metadataPath = path.join(safeDirectory, `${stem}.json`);
  const args = buildScreenshotCommand({ adbPath, serial });
  const record = {
    ...metadata,
    schemaVersion: 1,
    capturedAt: dryRun ? null : now(),
    serial,
    screenshot: path.basename(screenshotPath),
    command: [adbPath, ...args],
  };

  if (dryRun) {
    return {
      dryRun: true,
      command: args,
      screenshotPath,
      metadataPath,
      metadata: record,
    };
  }

  fs.mkdirSync(safeDirectory, { recursive: true });
  let image;
  try {
    image = execFileSync(adbPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    throw childProcessFailure(error, adbPath, args);
  }
  if (!isPng(image)) {
    throw new Error(
      `ADB screencap did not return a PNG for ${serial}. Refusing to save an unverified capture.`,
    );
  }

  const dimensions = parsePngDimensions(image);
  record.dimensions = dimensions;

  try {
    fs.writeFileSync(screenshotPath, image, { flag: "wx" });
    writeJsonExclusive(metadataPath, record);
  } catch (error) {
    throw new Error(`Could not persist screenshot metadata outside the repository: ${error.message}`);
  }

  return {
    dryRun: false,
    command: args,
    screenshotPath,
    metadataPath,
    metadata: record,
    dimensions,
    bytes: image.length,
  };
}

function parseArgs(argv) {
  const options = { dryRun: false };
  const valueOptions = new Set(["--serial", "--output", "--name", "--metadata-json", "--metadata-file"]);
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

function printHelp() {
  console.log(`Usage: node scripts/android/adb-screenshot.mjs --serial SERIAL [options]\n\n` +
    "Captures one PNG with adb exec-out screencap -p. The output directory must be outside the repository.\n" +
    "Options: --output DIR --name STEM --metadata-json JSON --metadata-file FILE --dry-run");
}

function loadMetadata(options) {
  if (options.metadata_file) {
    return JSON.parse(fs.readFileSync(path.resolve(options.metadata_file), "utf8"));
  }
  if (options.metadata_json) return JSON.parse(options.metadata_json);
  return {};
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const serial = options.serial || (options.dryRun ? "emulator-DRYRUN" : undefined);
  if (!serial) throw new Error("--serial is required outside --dry-run.");
  const outputDirectory = options.output
    ? path.resolve(normalizeWindowsPath(options.output))
    : options.dryRun
      ? path.join(os.tmpdir(), "runflow-visual-matrix-dry-run")
      : fs.mkdtempSync(path.join(os.tmpdir(), "runflow-visual-capture-"));
  const adbPath = options.dryRun ? "adb" : resolveAndroidTool("adb");
  const result = captureScreenshot({
    adbPath,
    serial,
    outputDirectory,
    name: options.name || "manual",
    metadata: loadMetadata(options),
    dryRun: options.dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}

const modulePath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (modulePath.toLowerCase() === invokedPath.toLowerCase()) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
