import { describe, expect, it } from "vitest";
import { collectAndroidProcessMetrics, parseMeminfo } from "./android-processes.mjs";

describe("Android performance process collector", () => {
  it("collects a complete synthetic Android snapshot with validated process identities", () => {
    const outputs = new Map<string, string>([
      [
        "shell ps -A -o PID,NAME,ARGS",
        [
          "PID NAME ARGS",
          "401 com.runflow.app com.runflow.app",
          "402 com.runflow.app:renderer com.runflow.app:renderer",
        ].join("\n"),
      ],
      [
        "shell dumpsys meminfo 401",
        ["TOTAL PSS: 12000", "TOTAL PRIVATE DIRTY: 5000", "Graphics: 700"].join("\n"),
      ],
      ["shell dumpsys meminfo 402", "TOTAL PSS: 3000"],
      ["shell dumpsys gfxinfo com.runflow.app", "Total frames rendered: 100\nJanky frames: 2 (2.0%)"],
      [
        "shell dumpsys gfxinfo com.runflow.app framestats",
        "Flags,IntendedVsync,FrameCompleted\n0,1,2\n0,3,4",
      ],
      ["shell dumpsys activity exit-info com.runflow.app", "ApplicationExitInfo: pid=401 reason=0"],
      ["logcat -d -t 200", "synthetic info"],
    ]);
    const runAdb = (args: string[]): string => {
      const key = args.join(" ");
      if (!outputs.has(key)) throw new Error(`unexpected synthetic adb command: ${key}`);
      return outputs.get(key)!;
    };

    const result = collectAndroidProcessMetrics({
      runAdb,
      packageName: "com.runflow.app",
      webViewPid: 402,
    });

    expect(result.processes.webview.pid).toBe(402);
    expect(result.metrics.appPssKb.value).toBe(12000);
    expect(result.metrics.webviewPssKb.value).toBe(3000);
    expect(result.metrics.frameTimeline.value.frameCount).toBe(2);
  });

  it("resolves the Android 37 isolated WebView renderer through activity process ownership", () => {
    const outputs = new Map<string, string>([
      [
        "shell ps -A -o PID,NAME,ARGS",
        [
          "PID NAME ARGS",
          "401 com.runflow.app com.runflow.app",
          "402 com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0 com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0",
        ].join("\n"),
      ],
      [
        "shell dumpsys activity processes",
        [
          "*APP* UID 99018 ProcessRecord{abc 402:com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0/u0a238i18}",
          "    packageList={com.runflow.app}",
          "    pid=402",
        ].join("\n"),
      ],
      ["shell dumpsys meminfo 401", "TOTAL PSS: 12000\nTOTAL PRIVATE DIRTY: 5000\nGraphics: 700"],
      ["shell dumpsys meminfo 402", "TOTAL PSS: 3000"],
      ["shell dumpsys gfxinfo com.runflow.app", "Total frames rendered: 100\nJanky frames: 2"],
      ["shell dumpsys gfxinfo com.runflow.app framestats", "Flags,IntendedVsync,FrameCompleted\n0,1,2"],
      ["shell dumpsys activity exit-info com.runflow.app", "ApplicationExitInfo: pid=401 reason=0"],
      ["logcat -d -t 200", "synthetic info"],
    ]);
    const runAdb = (args: string[]): string => {
      const key = args.join(" ");
      if (!outputs.has(key)) throw new Error(`unexpected synthetic adb command: ${key}`);
      return outputs.get(key)!;
    };

    const result = collectAndroidProcessMetrics({ runAdb, packageName: "com.runflow.app" });

    expect(result.processes.webview).toEqual({
      pid: 402,
      name: "com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0",
      packageNames: ["com.runflow.app"],
    });
  });

  it("parses Android 37 meminfo private dirty from the TOTAL table row", () => {
    const result = parseMeminfo(
      [
        "                   Pss  Private  Private  SwapPss",
        "                 Total    Dirty    Clean    Dirty",
        "        TOTAL   136574    59008    39092      162",
        "           TOTAL PSS:   136574            TOTAL RSS:   273588",
      ].join("\n"),
    );

    expect(result.pssKb).toBe(136574);
    expect(result.privateDirtyKb).toBe(59008);
  });

  it("fails closed when the app meminfo omits a required metric", () => {
    const outputs = new Map<string, string>([
      [
        "shell ps -A -o PID,NAME,ARGS",
        [
          "PID NAME ARGS",
          "401 com.runflow.app com.runflow.app",
          "402 com.runflow.app:renderer com.runflow.app:renderer",
        ].join("\n"),
      ],
      ["shell dumpsys meminfo 401", "TOTAL PSS: 12000\nTOTAL PRIVATE DIRTY: 5000"],
    ]);
    const runAdb = (args: string[]): string => {
      const key = args.join(" ");
      if (!outputs.has(key)) throw new Error(`unexpected synthetic adb command: ${key}`);
      return outputs.get(key)!;
    };

    expect(() =>
      collectAndroidProcessMetrics({
        runAdb,
        packageName: "com.runflow.app",
        webViewPid: 402,
      }),
    ).toThrow(/missing Android metric: appGraphicsKb/i);
  });
});
