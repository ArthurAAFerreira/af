// Runs automatically before `npm run build` (npm prebuild hook).
// Restores TypeScript source references in HTML files so Vite always
// recompiles from .ts sources instead of re-bundling old compiled assets.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const entries = [
  { html: 'index.html',     ts: './pages/index.ts'     },
  { html: 'cadastros.html', ts: './pages/cadastros.ts' },
  { html: 'relatorios.html', ts: './pages/relatorios.ts' },
];

for (const { html, ts } of entries) {
  const filepath = join(root, html);
  if (!existsSync(filepath)) continue;

  let content = readFileSync(filepath, 'utf-8');

  // Remove all modulepreload link lines (including data: URIs)
  content = content.replace(/[ \t]*<link rel="modulepreload"[^\n]*\n/g, '');

  // Replace compiled-asset script tag with TS source reference
  content = content.replace(
    /<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/,
    `<script type="module" src="${ts}"></script>`
  );

  // Remove bundled CSS link (CSS is re-emitted by Vite from the TS import)
  content = content.replace(/[ \t]*<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+\.css">\n?/g, '');

  // Collapse excessive blank lines
  content = content.replace(/\n{3,}/g, '\n\n');

  writeFileSync(filepath, content, 'utf-8');
  console.log(`[prebuild] Restored TS refs: ${html}`);
}
