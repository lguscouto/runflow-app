import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function makeBundleFixture(options: {
  chunkContent?: string;
  initialContent?: string;
  baseline?: Record<string, unknown>;
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runflow-bundle-"));
  const initial = options.initialContent ?? "window.initial = true;";
  const chunk = options.chunkContent ?? "window.route = true;";
  fs.mkdirSync(path.join(root, "out", "_next", "static", "chunks"), { recursive: true });
  fs.mkdirSync(path.join(root, ".next"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts", "perf"), { recursive: true });
  fs.writeFileSync(path.join(root, "out", "_next", "static", "chunks", "initial.js"), initial);
  fs.writeFileSync(path.join(root, "out", "_next", "static", "chunks", "route.js"), chunk);
  fs.writeFileSync(
    path.join(root, ".next", "app-build-manifest.json"),
    JSON.stringify({ pages: { "/layout": ["static/chunks/initial.js"], "/page": ["static/chunks/route.js"] } }),
  );
  fs.writeFileSync(
    path.join(root, "scripts", "perf", "bundle-budget.json"),
    JSON.stringify(
      options.baseline ?? {
        version: 1,
        maxRegressionRatio: 1.1,
        baselineTotalBytes: 200,
        baselineInitialBytes: 100,
        routes: { "/page": { baselineJsBytes: 100 } },
        forbiddenInitialPackages: ["three"],
      },
    ),
  );
  return root;
}

function runBudget(root: string) {
  return spawnSync(
    process.execPath,
    [path.join(process.cwd(), "scripts", "perf", "bundle-budget.mjs"), "--root", root],
    { encoding: "utf8" },
  );
}

describe("bundle budget gate", () => {
  it("passes a bundle within the versioned budget", () => {
    const root = makeBundleFixture({});
    try {
      const result = runBudget(root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Bundle budget OK");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a route regresses beyond the allowed budget", () => {
    const root = makeBundleFixture({ chunkContent: "x".repeat(201) });
    try {
      const result = runBudget(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("/page");
      expect(result.stderr).toContain("budget");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a forbidden package reaches the initial layout chunks", () => {
    const root = makeBundleFixture({ initialContent: "const THREE = {};" });
    try {
      const result = runBudget(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("forbidden package");
      expect(result.stderr).toContain("three");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when the build output is missing", () => {
    const root = makeBundleFixture({});
    fs.rmSync(path.join(root, "out"), { recursive: true, force: true });
    try {
      const result = runBudget(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("out directory");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
