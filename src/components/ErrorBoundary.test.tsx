/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function ProblematicComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated rendering failure");
  }
  return <div>Component rendered successfully</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Component rendered successfully")).toBeDefined();
  });

  it("catches errors and displays the default fallback UI", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <ProblematicComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("Ocorreu um erro ao carregar esta seção")).toBeDefined();
      expect(screen.getByText("Simulated rendering failure")).toBeDefined();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("supports custom ReactNode fallback", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary fallback={<div>Custom Fallback UI</div>}>
          <ProblematicComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom Fallback UI")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("supports fallback function with reset capability", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();
    try {
      render(
        <ErrorBoundary
          onReset={onReset}
          fallback={({ error, reset }) => (
            <div>
              <span>Error: {error.message}</span>
              <button onClick={reset}>Reset Me</button>
            </div>
          )}
        >
          <ProblematicComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Error: Simulated rendering failure")).toBeDefined();
      fireEvent.click(screen.getByText("Reset Me"));
      expect(onReset).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});
