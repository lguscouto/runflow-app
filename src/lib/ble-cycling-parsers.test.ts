import { describe, expect, it } from "vitest";
import {
  hasValidCscMeasurementPayload,
  hasValidCyclingPowerMeasurementPayload,
} from "./ble-cycling-parsers";

describe("BLE measurement payload validation", () => {
  it("rejects truncated CSC packets before parsing", () => {
    expect(hasValidCscMeasurementPayload(new DataView(new Uint8Array([0x03]).buffer))).toBe(false);
    expect(
      hasValidCscMeasurementPayload(new DataView(new Uint8Array([0x03, 0, 0, 0, 0, 0]).buffer))
    ).toBe(false);
    expect(
      hasValidCscMeasurementPayload(
        new DataView(new Uint8Array([0x03, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]).buffer)
      )
    ).toBe(true);
  });

  it("rejects truncated Cycling Power packets including optional fields", () => {
    expect(hasValidCyclingPowerMeasurementPayload(new DataView(new Uint8Array([0, 0, 0]).buffer))).toBe(
      false
    );
    expect(
      hasValidCyclingPowerMeasurementPayload(
        new DataView(new Uint8Array([0x20, 0x00, 0, 0, 0, 0]).buffer)
      )
    ).toBe(false);
    expect(
      hasValidCyclingPowerMeasurementPayload(
        new DataView(new Uint8Array([0x20, 0x00, 0, 0, 0, 0, 0, 0]).buffer)
      )
    ).toBe(true);
  });
});
