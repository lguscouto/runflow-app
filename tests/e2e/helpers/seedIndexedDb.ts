import type { Page } from "@playwright/test";

export interface SyntheticProfile {
  name: string;
  onboarded: true;
  language: "pt" | "en";
  updatedAt: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  weeklyDistanceKm?: number;
  weeklyWorkouts?: number;
}

export const SYNTHETIC_PROFILE: SyntheticProfile = {
  name: "E2E Synthetic User",
  onboarded: true,
  language: "pt",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export interface SeedIndexedDbOptions {
  profile?: Partial<SyntheticProfile>;
  reload?: boolean;
}

/**
 * Seeds only the synthetic onboarding record used by the web E2E context.
 * The page must already have loaded once so the application has created its
 * IndexedDB schema; no real browser profile or application data is touched.
 */
export async function seedIndexedDb(
  page: Page,
  { profile = {}, reload = true }: SeedIndexedDbOptions = {},
): Promise<void> {
  const seededProfile: SyntheticProfile = {
    ...SYNTHETIC_PROFILE,
    ...profile,
  };

  await page.waitForFunction(
    async () => {
      const factory = indexedDB as IDBFactory & {
        databases?: () => Promise<Array<{ name?: string; version?: number }>>;
      };

      if (typeof factory.databases !== "function") return true;

      const databases = await factory.databases();
      return databases.some(
        (database) => database.name === "runflow" && (database.version ?? 0) >= 7,
      );
    },
    undefined,
    { timeout: 10_000 },
  );

  await page.evaluate(async (value) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("runflow");

      request.onerror = () => {
        reject(request.error ?? new Error("Unable to open the synthetic RunFlow database"));
      };
      request.onblocked = () => {
        reject(new Error("Synthetic RunFlow database open was blocked"));
      };
      request.onsuccess = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains("profile")) {
          database.close();
          reject(new Error("RunFlow profile store is not available after application bootstrap"));
          return;
        }

        const transaction = database.transaction("profile", "readwrite");
        transaction.objectStore("profile").put(value, "user");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("Unable to seed the synthetic RunFlow profile"));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("Synthetic RunFlow profile transaction aborted"));
        };
      };
    });
  }, seededProfile);

  if (reload) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
}

export async function seedOnboardedProfile(
  page: Page,
  options?: SeedIndexedDbOptions,
): Promise<void> {
  await seedIndexedDb(page, options);
}
