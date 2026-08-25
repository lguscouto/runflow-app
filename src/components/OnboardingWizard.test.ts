import { describe, expect, it, vi } from "vitest";
import { consumeOnboardingBack } from "./OnboardingWizard";

describe("onboarding Android back behavior", () => {
  it("closes the wizard on the first step", () => {
    const onClose = vi.fn();
    const onPrevious = vi.fn();

    const consumed = consumeOnboardingBack({ show: true, step: 1, onClose, onPrevious });

    expect(consumed).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("moves to the previous step before closing the wizard", () => {
    const onClose = vi.fn();
    const onPrevious = vi.fn();

    const consumed = consumeOnboardingBack({ show: true, step: 3, onClose, onPrevious });

    expect(consumed).toBe(true);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not consume Back when the wizard is hidden", () => {
    const onClose = vi.fn();
    const onPrevious = vi.fn();

    const consumed = consumeOnboardingBack({ show: false, step: 1, onClose, onPrevious });

    expect(consumed).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
  });
});
