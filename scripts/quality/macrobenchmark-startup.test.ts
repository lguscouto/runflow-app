import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const startupBenchmarkPath = resolve(
  process.cwd(),
  "android/macrobenchmark/src/main/kotlin/com/runflow/app/macrobenchmark/StartupBenchmark.kt",
);
const journeysPath = resolve(
  process.cwd(),
  "android/macrobenchmark/src/main/kotlin/com/runflow/app/macrobenchmark/BenchmarkJourneys.kt",
);

describe("Macrobenchmark startup contract", () => {
  it("dispatches exactly COLD, WARM, and HOT through StartupMode", () => {
    const source = readFileSync(startupBenchmarkPath, "utf8");

    expect(source).toMatch(/fun coldStartup\(\)\s*=\s*measureStartup\(StartupMode\.COLD\)/);
    expect(source).toMatch(/fun warmStartup\(\)\s*=\s*measureStartup\(StartupMode\.WARM\)/);
    expect(source).toMatch(/fun hotStartup\(\)\s*=\s*measureStartup\(StartupMode\.HOT\)/);
    expect(source.match(/StartupMode\.(?:COLD|WARM|HOT)/g)).toHaveLength(3);
  });

  it("keeps StartupMode measurement free of Home/setup hooks", () => {
    const source = readFileSync(startupBenchmarkPath, "utf8");

    expect(source).toContain("startupMode = startupMode");
    expect(source).toContain("startActivityAndWait()");
    expect(source).not.toContain("setupBlock = {");
    expect(source).not.toContain("pressHome()");
  });

  it("generates identifiable startup and frame metrics for every run", () => {
    const source = readFileSync(startupBenchmarkPath, "utf8");
    const journeys = readFileSync(journeysPath, "utf8");

    expect(source).toContain("StartupTimingMetric()");
    expect(source).toContain("FrameTimingMetric()");
    expect(source).toContain("iterations = BenchmarkJourneys.DEFAULT_ITERATIONS");
    expect(source).toContain('traceSyntheticJourney("startup-${startupMode.name.lowercase()}")');
    expect(journeys).toContain('Trace.beginSection("$marker.start")');
    expect(journeys).toContain('Trace.beginSection("$marker.end")');
  });
});
