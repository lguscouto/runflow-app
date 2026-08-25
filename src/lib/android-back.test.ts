import { afterEach, describe, expect, it } from "vitest";
import { dispatchAndroidBack, registerAndroidBackHandler } from "./android-back";

afterEach(() => {
  registerAndroidBackHandler(null);
});

describe("Android back dispatch", () => {
  it("dispatches to the active screen handler and reports whether it consumed Back", () => {
    let calls = 0;
    const unregister = registerAndroidBackHandler(() => {
      calls += 1;
      return true;
    });

    expect(dispatchAndroidBack()).toBe(true);
    expect(calls).toBe(1);

    unregister();
    expect(dispatchAndroidBack()).toBe(false);
  });

  it("does not consume Back when no screen handler is registered", () => {
    expect(dispatchAndroidBack()).toBe(false);
  });
});
