import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateVersionConsistency } from "./version-consistency.mjs";

describe("RunFlow release metadata", () => {
  it("keeps web, lockfile, and Android versions aligned", () => {
    expect(validateVersionConsistency(process.cwd())).toEqual([]);
  });

  it("accepts the API 36 Android compile and target SDK", () => {
    expect(validateVersionConsistency(process.cwd())).not.toContain(
      "Android compileSdkVersion/targetSdkVersion must be 36",
    );
  });

  it("rejects a fixture that still targets API 35", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "runflow-version-gate-"));
    try {
      mkdirSync(path.join(root, "android", "app"), { recursive: true });
      writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.9.8" }));
      writeFileSync(
        path.join(root, "package-lock.json"),
        JSON.stringify({ version: "0.9.8", packages: { "": { version: "0.9.8" } } }),
      );
      writeFileSync(
        path.join(root, "android", "app", "build.gradle"),
        'versionCode 4\nversionName "0.9.8"\n',
      );
      writeFileSync(
        path.join(root, "android", "variables.gradle"),
        "compileSdkVersion = 35\ntargetSdkVersion = 35\n",
      );
      expect(validateVersionConsistency(root)).toContain(
        "Android compileSdkVersion/targetSdkVersion must be 36",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("reports success when invoked as the quality gate", () => {
    const script = path.join(process.cwd(), "scripts", "quality", "version-consistency.mjs");
    const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
    expect(output).toContain("Version consistency OK: 0.9.8 (code 4)");
  });

});
