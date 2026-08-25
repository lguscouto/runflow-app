import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const macrobenchmarkBuild = fs.readFileSync(
  path.resolve(process.cwd(), "android/macrobenchmark/build.gradle"),
  "utf8",
);
const appBuild = fs.readFileSync(
  path.resolve(process.cwd(), "android/app/build.gradle"),
  "utf8",
);
const journeys = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "android/macrobenchmark/src/main/kotlin/com/runflow/app/macrobenchmark/BenchmarkJourneys.kt",
  ),
  "utf8",
);
const moduleReadme = fs.readFileSync(
  path.resolve(process.cwd(), "android/macrobenchmark/README.md"),
  "utf8",
);

describe("macrobenchmark variant contract", () => {
  it("targets the app benchmark variant explicitly", () => {
    expect(macrobenchmarkBuild).toContain('targetProjectPath = ":app"');
    expect(macrobenchmarkBuild).toContain(
      'experimentalProperties["android.experimental.self-instrumenting"] = true',
    );
    expect(appBuild).toMatch(
      /benchmark\s*\{[\s\S]*?applicationIdSuffix\s+"\.benchmark"[\s\S]*?debuggable\s+false/,
    );
    expect(journeys).toContain('TARGET_PACKAGE = "com.runflow.app.benchmark"');
  });

  it("falls back to release variants for app dependencies", () => {
    expect(macrobenchmarkBuild).toContain("matchingFallbacks = ['release']");
  });

  it("signs both installed benchmark APKs with local debug keys", () => {
    expect(macrobenchmarkBuild).toMatch(
      /buildTypes\s*\{[\s\S]*?benchmark\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
    );
    expect(appBuild).toMatch(
      /benchmark\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
    );
  });

  it("passes only the framework emulator precondition override", () => {
    expect(macrobenchmarkBuild).toMatch(
      /testInstrumentationRunnerArguments\s*\[\"androidx\.benchmark\.suppressErrors\"\]\s*=\s*\"EMULATOR\"/,
    );
    expect(macrobenchmarkBuild).not.toMatch(/suppressErrors[^\n]*\b(?:ALL|DEBUGGABLE|NOT_PROFILEABLE)\b/);
  });

  it("documents emulator-only evidence and the missing fixture provisioner", () => {
    expect(moduleReadme).toContain("emulator-only");
    expect(moduleReadme).toContain("não há benchmark válido");
    expect(moduleReadme).toContain("não declara baseline físico");
    expect(moduleReadme).toMatch(/não\s+executa testes `connected`/);
  });
});
