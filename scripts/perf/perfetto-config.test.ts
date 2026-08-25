import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Perfetto collector configuration", () => {
  it("captures bounded scheduling, graphics and frame-timeline data", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "scripts", "perf", "perfetto-config.pbtxt"), "utf8");

    expect(config).toContain("duration_ms: 10000");
    expect(config).toContain("write_into_file: true");
    expect(config).toContain('name: "linux.ftrace"');
    expect(config).toContain('name: "android.surfaceflinger.frametimeline"');
    expect(config).toContain('name: "track_event"');
    expect(config).toContain('ftrace_events: "sched/sched_switch"');
    expect(config).toContain('ftrace_events: "power/cpu_frequency"');
    expect(config).toContain('atrace_categories: "gfx"');
    expect(config).toContain('atrace_categories: "webview"');
    expect(config).toContain('enabled_categories: "android"');
    expect(config).toContain('enabled_categories: "webview"');
  });
});
