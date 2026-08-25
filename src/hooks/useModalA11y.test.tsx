/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { useModalA11y } from "./useModalA11y";

interface HarnessProps {
  isOpen: boolean;
  onClose: () => void;
}

function ModalHarness({ isOpen, onClose }: HarnessProps) {
  const { modalRef } = useModalA11y({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div ref={modalRef} role="dialog" aria-label="Test modal">
      <button type="button">First action</button>
      <button type="button">Last action</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useModalA11y", () => {
  it("focuses the first focusable control immediately when opened", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open modal";
    document.body.appendChild(trigger);
    trigger.focus();

    render(<ModalHarness isOpen onClose={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First action" }));
  });

  it("wraps Tab from the last control to the first control", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    render(<ModalHarness isOpen onClose={vi.fn()} />);

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("wraps Shift+Tab from the first control to the last control", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    render(<ModalHarness isOpen onClose={vi.fn()} />);

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });
    first.focus();

    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("closes the modal on Escape and prevents the browser default", () => {
    const onClose = vi.fn();
    render(<ModalHarness isOpen onClose={onClose} />);

    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the element that opened the modal", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open modal";
    document.body.appendChild(trigger);
    trigger.focus();

    const view = render(<ModalHarness isOpen onClose={vi.fn()} />);
    view.rerender(<ModalHarness isOpen={false} onClose={vi.fn()} />);

    expect(document.activeElement).toBe(trigger);
  });

  it("keeps focus in the modal and uses the latest unstable close callback", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const firstOnClose = vi.fn();
    const latestOnClose = vi.fn();
    const view = render(<ModalHarness isOpen onClose={firstOnClose} />);
    const first = screen.getByRole("button", { name: "First action" });

    view.rerender(<ModalHarness isOpen onClose={() => latestOnClose()} />);

    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstOnClose).not.toHaveBeenCalled();
    expect(latestOnClose).toHaveBeenCalledTimes(1);
  });
});
