import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const benchmarkRoot = resolve(
  process.cwd(),
  "android/macrobenchmark/src/main/kotlin/com/runflow/app/macrobenchmark",
);

function readBenchmark(name: string): string {
  return readFileSync(resolve(benchmarkRoot, name), "utf8");
}

const journeyBenchmarkNames = [
  "ActivityScrollBenchmark.kt",
  "ActivityDetailBenchmark.kt",
  "MapBenchmark.kt",
  "HeatmapBenchmark.kt",
  "FlyoverBenchmark.kt",
  "RotationBackgroundBenchmark.kt",
];

describe("Macrobenchmark journey contracts", () => {
  it("enters the activity context before detail-dependent journeys", () => {
    const detail = readBenchmark("ActivityDetailBenchmark.kt");
    const map = readBenchmark("MapBenchmark.kt");
    const heatmap = readBenchmark("HeatmapBenchmark.kt");
    const flyover = readBenchmark("FlyoverBenchmark.kt");

    expect(detail).toMatch(/openActivities\(device\)[\s\S]*openFirstSyntheticActivity\(device\)/);
    expect(map).toMatch(
      /openActivities\(device\)[\s\S]*openFirstSyntheticActivity\(device\)[\s\S]*openMap\(device\)/,
    );
    expect(heatmap).toMatch(/openActivities\(device\)[\s\S]*hasSyntheticActivity\(device\)[\s\S]*openHeatmap\(device\)/);
    expect(flyover).toMatch(
      /openActivities\(device\)[\s\S]*openSyntheticFlyoverActivity\(device\)[\s\S]*openFlyover\(device\)/,
    );
  });

  it("uses FrameTimingMetric and the shared iteration budget for every journey", () => {
    for (const name of journeyBenchmarkNames) {
      const source = readBenchmark(name);

      expect(source, name).toContain("FrameTimingMetric()");
      expect(source, name).toContain("iterations = BenchmarkJourneys.DEFAULT_ITERATIONS");
      expect(source, name).not.toContain("startupMode =");
    }
  });

  it("keeps Home/setup hooks confined to non-startup journeys", () => {
    const startup = readBenchmark("StartupBenchmark.kt");
    const nonStartup = journeyBenchmarkNames.map(readBenchmark).join("\n");

    expect(startup).not.toContain("setupBlock = {");
    expect(startup).not.toContain("pressHome()");
    expect(nonStartup).toContain("setupBlock = {");
    expect(nonStartup).toContain("pressHome()");
  });

  it("identifies each measured journey with a distinct trace name", () => {
    const source = journeyBenchmarkNames.map(readBenchmark).join("\n");
    const names = [...source.matchAll(/traceSyntheticJourney\("([^\"]+)"\)/g)].map(
      ([, name]) => name,
    );

    expect(names).toHaveLength(journeyBenchmarkNames.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses concrete semantic labels for the rendered detail controls", () => {
    const journeys = readBenchmark("BenchmarkJourneys.kt");

    expect(journeys).toContain('"Mapa 2D"');
    expect(journeys).toContain('"2D Map"');
    expect(journeys).toContain('"🔥 Mapa de Calor"');
    expect(journeys).toContain('"🔥 Heatmap"');
    expect(journeys).toContain('"3D Flyover"');
  });

  it("uses a dedicated 50,000-point fixture for Flyover", () => {
    const journeys = readBenchmark("BenchmarkJourneys.kt");

    expect(journeys).toContain("const val DEFAULT_ITERATIONS = 20");
    expect(journeys).toContain("const val SYNTHETIC_ACTIVITY_COUNT = 1_000");
    expect(journeys).toContain("const val SYNTHETIC_FLYOVER_POINT_COUNT = 50_000");
    expect(journeys).toMatch(
      /syntheticFlyoverFixture[\s\S]*pointCount\s*=\s*SYNTHETIC_FLYOVER_POINT_COUNT/,
    );
  });

  it("does not accept a generic detail control as the synthetic fixture", () => {
    const journeys = readBenchmark("BenchmarkJourneys.kt");

    expect(journeys).not.toMatch(
      /fixture\.title[\s\S]*\|\|\s*tapSemantic\(device,\s*detailLabels\)/,
    );
  });

  it("fails closed when the synthetic activity fixture is absent", () => {
    const journeys = readBenchmark("BenchmarkJourneys.kt");
    const scroll = readBenchmark("ActivityScrollBenchmark.kt");
    const heatmap = readBenchmark("HeatmapBenchmark.kt");

    expect(journeys).toMatch(
      /fun scrollSyntheticActivities[\s\S]*hasSyntheticActivity\(device\)[\s\S]*syntheticActivities\.lastIndex/,
    );
    expect(scroll).toContain("scrollSyntheticActivities(device)");
    expect(heatmap).toMatch(
      /openActivities\(device\)[\s\S]*hasSyntheticActivity\(device\)[\s\S]*openHeatmap\(device\)/,
    );
  });

  it("scrolls until the last synthetic activity is visible instead of using ten fixed swipes", () => {
    const journeys = readBenchmark("BenchmarkJourneys.kt");

    expect(journeys).toContain("scrollable.scrollUntil(");
    expect(journeys).toMatch(
      /Until\.hasObject\(By\.text\(syntheticActivities\.last\(\)\.title\)\)/,
    );
    expect(journeys).not.toContain("repeat(10)");
  });

});
