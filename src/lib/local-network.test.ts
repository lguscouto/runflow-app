import { describe, it, expect } from "vitest";
import { checkLocalNetworkPermission, requestLocalNetworkPermission } from "./local-network";

describe("Local Network Permission Bridge", () => {
  it("returns a boolean for checkLocalNetworkPermission", async () => {
    const granted = await checkLocalNetworkPermission();
    expect(typeof granted).toBe("boolean");
  });

  it("returns a boolean for requestLocalNetworkPermission", async () => {
    const granted = await requestLocalNetworkPermission();
    expect(typeof granted).toBe("boolean");
  });
});
