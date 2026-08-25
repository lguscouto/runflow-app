import { registerPlugin } from "@capacitor/core";

export interface AppLocalePluginInterface {
  getAppLocale(): Promise<{ language: string | null }>;
  setAppLocale(options: { language: string }): Promise<{ success: boolean }>;
}

const AppLocale = registerPlugin<AppLocalePluginInterface>("AppLocale");

export async function getNativeAppLocale(): Promise<string | null> {
  try {
    const res = await AppLocale.getAppLocale();
    return res.language || null;
  } catch {
    return null;
  }
}

export async function setNativeAppLocale(language: string): Promise<boolean> {
  try {
    const res = await AppLocale.setAppLocale({ language });
    return res.success;
  } catch {
    return false;
  }
}
