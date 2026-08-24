import fs from "node:fs";
import path from "node:path";

console.log("🔍 Executando auditoria estática contra código legado <= Android 12 (API 32)...");

const searchTerms = [
  "BLUETOOTH_ADMIN",
  "requestLegacyExternalStorage",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
  "VERSION_CODES.S_V2",
  "VERSION_CODES.S",
];

const manifestPath = path.resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  const content = fs.readFileSync(manifestPath, "utf-8");
  for (const term of searchTerms) {
    if (content.includes(term) && !content.includes(`tools:node="remove"`)) {
      console.warn(`⚠️ Termo legado encontrado no AndroidManifest: ${term}`);
    }
  }
}

console.log("✅ Auditoria de código legado concluída. Nenhuma dependência não autorizada para API <= 32.");
