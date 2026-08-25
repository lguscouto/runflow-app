import type { Page, Request } from "@playwright/test";

export interface RuntimeGuard {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  assertClean(): void;
}

export function installRuntimeGuard(
  page: Page,
  options: { ignoreFailedRequest?: (request: Request) => boolean } = {},
): RuntimeGuard {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    if (options.ignoreFailedRequest?.(request)) return;
    failedRequests.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown"}`);
  });

  return {
    pageErrors,
    consoleErrors,
    failedRequests,
    assertClean() {
      const issues = [
        ...pageErrors.map((message) => `pageerror: ${message}`),
        ...consoleErrors.map((message) => `console: ${message}`),
        ...failedRequests.map((message) => `requestfailed: ${message}`),
      ];
      if (issues.length > 0) {
        throw new Error(`Runtime guard detected unexpected errors:\n${issues.join("\n")}`);
      }
    },
  };
}
