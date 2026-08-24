import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "out");
if (!fs.existsSync(outDir)) {
  console.log("ℹ️ Diretório out/ não encontrado. Execute npm run build antes.");
  process.exit(0);
}

console.log("📊 Analisando tamanho dos chunks gerados no out/...");
const staticChunksDir = path.join(outDir, "_next", "static", "chunks");
if (fs.existsSync(staticChunksDir)) {
  const files = fs.readdirSync(staticChunksDir);
  let totalSize = 0;
  for (const file of files) {
    if (file.endsWith(".js")) {
      const stats = fs.statSync(path.join(staticChunksDir, file));
      totalSize += stats.size;
    }
  }
  console.log(`✅ Total de chunks JS estáticos: ${(totalSize / 1024).toFixed(1)} KB`);
}
