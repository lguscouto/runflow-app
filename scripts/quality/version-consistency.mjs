import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_VERSION = "0.9.8";
const EXPECTED_VERSION_CODE = "4";

function readJson(root, relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function validateVersionConsistency(root = process.cwd()) {
  const packageJson = readJson(root, "package.json");
  const packageLock = readJson(root, "package-lock.json");
  const androidBuild = fs.readFileSync(
    path.join(root, "android", "app", "build.gradle"),
    "utf8",
  );
  const errors = [];

  if (packageJson.version !== EXPECTED_VERSION) {
    errors.push(`package.json version is ${packageJson.version}, expected ${EXPECTED_VERSION}`);
  }
  if (packageLock.version !== EXPECTED_VERSION) {
    errors.push(`package-lock.json version is ${packageLock.version}, expected ${EXPECTED_VERSION}`);
  }
  if (packageLock.packages?.[""].version !== EXPECTED_VERSION) {
    errors.push(
      `package-lock.json root package version is ${packageLock.packages?.[""].version}, expected ${EXPECTED_VERSION}`,
    );
  }

  const versionCode = androidBuild.match(/versionCode\s+(\d+)/)?.[1];
  const versionName = androidBuild.match(/versionName\s+["']([^"']+)["']/)?.[1];
  if (versionCode !== EXPECTED_VERSION_CODE) {
    errors.push(`android versionCode is ${versionCode ?? "missing"}, expected ${EXPECTED_VERSION_CODE}`);
  }
  if (versionName !== EXPECTED_VERSION) {
    errors.push(`android versionName is ${versionName ?? "missing"}, expected ${EXPECTED_VERSION}`);
  }

  const androidVariables = fs.readFileSync(
    path.join(root, "android", "variables.gradle"),
    "utf8",
  );
  const compileSdk = androidVariables.match(/compileSdkVersion\s*=\s*([^\s]+)/)?.[1];
  const targetSdk = androidVariables.match(/targetSdkVersion\s*=\s*([^\s]+)/)?.[1];
  if (compileSdk !== "36" || targetSdk !== "36") {
    errors.push("Android compileSdkVersion/targetSdkVersion must be 36");
  }

  return errors;
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (scriptPath === invokedPath) {
  const errors = validateVersionConsistency();
  if (errors.length > 0) {
    console.error("Version consistency check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Version consistency OK: ${EXPECTED_VERSION} (code ${EXPECTED_VERSION_CODE})`);
  }
}
