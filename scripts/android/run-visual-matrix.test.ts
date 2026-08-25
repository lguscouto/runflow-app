import { describe, expect, it } from "vitest";
import {
  assertCaseApplied,
  assertScreenshotDimensions,
  buildApplyCommands,
  buildPostLaunchCommands,
} from "./run-visual-matrix.mjs";

describe("assertCaseApplied", () => {
  it("accepts a requested density that equals the physical density without an override", () => {
    expect(() =>
      assertCaseApplied(
        {
          id: "phone-compact-portrait-100-gesture",
          size: "360x640",
          density: 420,
          fontScale: 1,
          rotation: 0,
          navigation: "gesture",
        },
        {
          size: { override: "360x640" },
          density: { physical: 420, override: null },
          fontScale: "1.0",
          rotation: { userRotation: 0 },
          navigation: { mode: 2 },
        },
      ),
    ).not.toThrow();
  });

  it("locks the display rotation through WindowManager for landscape cases", () => {
    const rotationCommand = buildApplyCommands({
      id: "phone-landscape-100-three-buttons",
      size: "844x390",
      density: 420,
      fontScale: 1,
      rotation: 1,
      navigation: "three-buttons",
    }).find((command) => command.label === "rotation");

    expect(rotationCommand?.args).toEqual(["shell", "wm", "user-rotation", "lock", "1"]);

    const sizeCommand = buildApplyCommands({
      id: "phone-landscape-100-three-buttons",
      size: "844x390",
      density: 420,
      fontScale: 1,
      rotation: 1,
      navigation: "three-buttons",
    }).find((command) => command.label === "size");

    expect(sizeCommand?.args).toEqual(["shell", "wm", "size", "390x844"]);
  });

  it("reapplies the requested rotation after launching the app", () => {
    expect(
      buildPostLaunchCommands({
        id: "phone-landscape-100-three-buttons",
        size: "844x390",
        density: 420,
        fontScale: 1,
        rotation: 1,
        navigation: "three-buttons",
      }),
    ).toEqual([{ label: "rotation-post-launch", args: ["shell", "wm", "user-rotation", "lock", "1"] }]);
  });

  it("rejects a capture whose PNG dimensions do not match the requested size", () => {
    const matrixCase = {
      id: "phone-landscape-100-three-buttons",
      size: "844x390",
      density: 420,
      fontScale: 1,
      rotation: 1,
      navigation: "three-buttons",
    };

    expect(() => assertScreenshotDimensions(matrixCase, { width: 844, height: 390 })).not.toThrow();
    expect(() => assertScreenshotDimensions(matrixCase, { width: 390, height: 844 })).toThrow(/844x390/);
  });
});
