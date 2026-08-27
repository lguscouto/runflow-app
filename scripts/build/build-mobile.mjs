import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isWindows = process.platform === "win32";
const nodeDirectory = path.dirname(process.execPath);
const npm = isWindows
  ? [process.execPath, process.env.npm_execpath ?? path.join(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js")]
  : ["npm"];
const npx = isWindows
  ? [process.execPath, path.join(nodeDirectory, "node_modules", "npm", "bin", "npx-cli.js")]
  : ["npx"];
const gradle = isWindows ? "gradlew.bat" : "./gradlew";
const mobileEnvironment = { ...process.env, NEXT_EXPORT_TARGET: "capacitor" };

function run([command, ...commandArgs], args, options = {}) {
  const result = spawnSync(command, [...commandArgs, ...args], {
    cwd: projectRoot,
    env: mobileEnvironment,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npm, ["run", "build"]);
run(npx, ["cap", "sync", "android"]);
if (isWindows) {
  run([process.env.ComSpec ?? "cmd.exe"], ["/d", "/s", "/c", `${gradle} assembleDebug`], {
    cwd: path.join(projectRoot, "android"),
  });
} else {
  run([gradle], ["assembleDebug"], { cwd: path.join(projectRoot, "android") });
}