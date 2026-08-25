import fs from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.resolve(process.env.NEXT_EXPORT_DIR ?? "out");
const fileProtocolBootstrap = `<script data-runflow-file-bootstrap>(function(){if(location.protocol!=="file:")return;const root=new URL("./",location.href);const rewrite=function(value){return typeof value==="string"&&value.startsWith("/_next/")?new URL("."+value,root).href:value};const setAttribute=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(name==="href"||name==="src")value=rewrite(String(value));return setAttribute.call(this,name,value)};const appendChild=Node.prototype.appendChild;Node.prototype.appendChild=function(node){if(node instanceof Element){if(node.hasAttribute("href"))node.setAttribute("href",node.getAttribute("href"));if(node.hasAttribute("src"))node.setAttribute("src",node.getAttribute("src"))}return appendChild.call(this,node)};})();</script>`;

function relativePrefix(filePath) {
  const relativeDirectory = path.relative(outputDirectory, path.dirname(filePath));
  const depth = relativeDirectory ? relativeDirectory.split(path.sep).filter(Boolean).length : 0;
  return "../".repeat(depth) || "./";
}

function rewriteHtml(content, prefix) {
  const rewritten = content.replace(/((?:href|src)=\")\/_next\//g, `$1${prefix}_next/`);
  return rewritten.includes("data-runflow-file-bootstrap")
    ? rewritten
    : rewritten.replace("</head>", `${fileProtocolBootstrap}</head>`);
}

function rewriteCss(content, prefix) {
  return content.replace(/(url\(\s*["']?)\/_next\//g, `$1${prefix}_next/`);
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(filePath)));
    else files.push(filePath);
  }
  return files;
}

const files = await walk(outputDirectory);
let htmlFiles = 0;
let cssFiles = 0;

for (const filePath of files) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension !== ".html" && extension !== ".css") continue;

  const original = await fs.readFile(filePath, "utf8");
  const prefix = relativePrefix(filePath);
  const rewritten = extension === ".html"
    ? rewriteHtml(original, prefix)
    : rewriteCss(original, prefix);

  if (rewritten !== original) {
    await fs.writeFile(filePath, rewritten, "utf8");
    if (extension === ".html") htmlFiles += 1;
    else cssFiles += 1;
  }
}

console.log(`Patched static export paths: ${htmlFiles} HTML, ${cssFiles} CSS`);
