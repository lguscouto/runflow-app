import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("Android privacy contract", () => {
  it("disables operating-system backup and device transfer for local activity data", async () => {
    const manifest = await readFile(
      resolve(root, "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );

    expect(manifest).toMatch(/android:allowBackup="false"/);
    expect(manifest).not.toMatch(/android:allowBackup="true"/);
  });
});
