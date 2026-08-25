import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePairingCode, generatePairingToken, sanitizePairingCode } from "./p2p";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("P2P pairing code", () => {
  it("uses a cryptographic random source instead of Math.random", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const code = generatePairingCode();

    expect(randomSpy).not.toHaveBeenCalled();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(sanitizePairingCode(code)).toBe(code);
  });

  it("uses a random transport id separate from the pairing secret", () => {
    const token = generatePairingToken();

    expect(token).toMatch(/^runflow-[a-f0-9]{32}\.[A-Z2-9]{6}$/);
    const [peerId, secret] = token.split(".");
    expect(peerId).not.toContain(secret);
  });
});
