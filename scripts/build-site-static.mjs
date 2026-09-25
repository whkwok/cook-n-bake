import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(rootDir, 'dist');

const entries = [
  '.nojekyll',
  'admin.html',
  'cook-bake-academy-market-report.html',
  'css',
  'data',
  'index.html',
  'js'
];

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

for (const entry of entries) {
  const source = path.join(rootDir, entry);
  const target = path.join(outDir, entry);
  try {
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(source, target);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

console.log(`Built static site in ${path.relative(rootDir, outDir)}`);
