import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function makeFixtureRoot(manifests: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runflow-legacy-"));
  for (const [relativePath, content] of Object.entries(manifests)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }
  return root;
}

function runAudit(root: string) {
  return spawnSync(
    process.execPath,
    [path.join(process.cwd(), "scripts", "android", "audit-legacy.mjs"), "--root", root],
    { encoding: "utf8" },
  );
}

describe("legacy Android audit", () => {
  it("passes source removal directives and clean merged variants", () => {
    const root = makeFixtureRoot({
      "android/app/src/main/AndroidManifest.xml": `
        <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" tools:node="remove" />
      `,
      "android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml": "<manifest />",
      "android/app/build/intermediates/merged_manifests/benchmark/processBenchmarkManifest/AndroidManifest.xml": "<manifest />",
      "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml": "<manifest />",
    });
    try {
      const result = runAudit(root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Legacy audit OK");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails and reports the exact merged manifest containing a legacy permission", () => {
    const root = makeFixtureRoot({
      "android/app/src/main/AndroidManifest.xml": "<manifest />",
      "android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml": `
        <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
      `,
      "android/app/build/intermediates/merged_manifests/benchmark/processBenchmarkManifest/AndroidManifest.xml": "<manifest />",
      "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml": "<manifest />",
    });
    try {
      const result = runAudit(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("READ_EXTERNAL_STORAGE");
      expect(result.stderr).toContain("processDebugManifest/AndroidManifest.xml");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a required merged variant is absent", () => {
    const root = makeFixtureRoot({
      "android/app/src/main/AndroidManifest.xml": "<manifest />",
    });
    try {
      const result = runAudit(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("merged manifest variant missing");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
