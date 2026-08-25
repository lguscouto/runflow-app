import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEGACY_TERMS = [
  "BLUETOOTH_ADMIN",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE",
  "requestLegacyExternalStorage",
];

const REQUIRED_VARIANTS = ["debug", "benchmark", "release"];

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

function relative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function resolveManifestFiles(root) {
  const androidRoot = path.join(root, "android", "app");
  const sourceManifest = path.join(androidRoot, "src", "main", "AndroidManifest.xml");
  const files = [{ filePath: sourceManifest, kind: "source" }];
  const errors = [];

  if (!fs.existsSync(sourceManifest)) {
    errors.push(`source manifest missing: ${relative(root, sourceManifest)}`);
  }

  const mergedRoot = path.join(androidRoot, "build", "intermediates", "merged_manifests");
  for (const variant of REQUIRED_VARIANTS) {
    const candidates = walkFiles(path.join(mergedRoot, variant)).filter(
      (filePath) => path.basename(filePath) === "AndroidManifest.xml",
    );
    if (candidates.length === 0) {
      errors.push(`merged manifest variant missing: ${variant}`);
    } else {
      files.push(...candidates.map((filePath) => ({ filePath, kind: "merged" })));
    }
  }

  return { files, errors };
}

export function auditLegacy(root = process.cwd()) {
  const { files, errors } = resolveManifestFiles(root);
  const violations = [];

  for (const { filePath, kind } of files) {
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const term of LEGACY_TERMS) {
        if (!line.includes(term)) continue;
        const removalDirective =
          kind === "source" && /tools:node\s*=\s*["']remove["']/.test(line);
        if (!removalDirective) {
          violations.push({
            file: relative(root, filePath),
            line: index + 1,
            term,
            text: line.trim(),
          });
        }
      }
    });
  }

  return { files: files.map(({ filePath }) => relative(root, filePath)), errors, violations };
}

function getRoot(args) {
  const index = args.indexOf("--root");
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]) : process.cwd();
}

const scriptPath = path.resolve(fileURLToPath(import.meta.url));
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (scriptPath === invokedPath) {
  const root = getRoot(process.argv.slice(2));
  const report = auditLegacy(root);
  if (report.errors.length > 0 || report.violations.length > 0) {
    console.error("Legacy audit failed:");
    for (const error of report.errors) console.error(`- ${error}`);
    for (const violation of report.violations) {
      console.error(
        `- ${violation.file}:${violation.line} contains ${violation.term}: ${violation.text}`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(`Legacy audit OK: scanned ${report.files.length} manifest files.`);
  }
}
