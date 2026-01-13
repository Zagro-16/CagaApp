import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const SITE_DIR = path.join(root, "cagaapp-site");
const APP_DIR = path.join(root, "cagaapp-app");
const PUBLISH_DIR = path.join(root, "publish");
const PUBLISH_APP_DIR = path.join(PUBLISH_DIR, "app");

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}\n(cwd: ${cwd})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensure(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

(async function main() {
  // 0) pulizia
  rm(PUBLISH_DIR);
  ensure(PUBLISH_APP_DIR);

  // 1) build APP (Vite)
  // Netlify installa solo le deps root: quindi facciamo install dentro cagaapp-app
  if (!exists(path.join(APP_DIR, "node_modules"))) {
    run("npm ci", APP_DIR);
  } else {
    // se node_modules già presente (cache), meglio comunque allineare
    run("npm ci", APP_DIR);
  }
  run("npm run build", APP_DIR);

  // 2) copia SITE in publish root
  copyDir(SITE_DIR, PUBLISH_DIR);

  // 3) copia dist app in publish/app
  const distDir = path.join(APP_DIR, "dist");
  if (!exists(distDir)) {
    throw new Error("Non trovo cagaapp-app/dist. La build Vite non è andata a buon fine.");
  }
  copyDir(distDir, PUBLISH_APP_DIR);

  // 4) redirect SPA (se non vuoi usare netlify.toml per redirect, ma qui lo hai già)
  // (lasciato volutamente vuoto)

  console.log("\n✅ Build completata: publish/ (sito) + publish/app (app)\n");
})();
