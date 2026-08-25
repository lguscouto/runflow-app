import { describe, expect, it } from "vitest";
import { createSerializedAsyncQueue } from "./serialized-async-queue";

describe("serialized async queue", () => {
  it("runs locale persistence operations in invocation order", async () => {
    const events: string[] = [];
    const queue = createSerializedAsyncQueue(async (value: string) => {
      events.push(`${value}:start`);
      await Promise.resolve();
      events.push(`${value}:end`);
    });

    const first = queue("pt");
    const second = queue("en");
    await Promise.all([first, second]);

    expect(events).toEqual(["pt:start", "pt:end", "en:start", "en:end"]);
  });
});
