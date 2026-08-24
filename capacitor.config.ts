import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.runflow.app",
  appName: "RunFlow",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
