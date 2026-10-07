/**
 * Copies the pdf.js worker into /public so it can be loaded from a stable URL
 * (`/pdf.worker.min.mjs`) regardless of which bundler Next.js is using.
 * Runs before `dev` and `build`.
 */
import { copyFileSync, cpSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
// fileURLToPath handles Windows drive letters and percent-encoded spaces.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const candidates = [
  "pdfjs-dist/build/pdf.worker.min.mjs",
  "pdfjs-dist/build/pdf.worker.mjs",
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
];

let source = null;
for (const candidate of candidates) {
  try {
    source = require.resolve(candidate);
    break;
  } catch {
    /* try next */
  }
}

if (!source) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found — run `npm install` first.");
  process.exit(0);
}

const publicDir = join(root, "public");
if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

const target = join(publicDir, "pdf.worker.min.mjs");
copyFileSync(source, target);
console.log(`[copy-pdf-worker] ${source} -> ${target}`);

// cmaps + standard fonts let pdf.js render PDFs that do not embed their fonts.
const distRoot = resolve(dirname(source), "..");
for (const asset of ["cmaps", "standard_fonts"]) {
  const from = join(distRoot, asset);
  if (!existsSync(from)) continue;
  const to = join(publicDir, "pdfjs", asset);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[copy-pdf-worker] ${asset} -> ${to}`);
}
