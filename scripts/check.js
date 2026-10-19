// Validering: syntaxkollar alla JS-filer och att JSON-filerna går att läsa. Kör: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dirs = ['server', 'shared', 'client', 'scripts', 'test'];
const jsonFiles = ['package.json', 'client/manifest.json', '.claude/launch.json'];
const errors = [];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const jsFiles = dirs.filter((d) => fs.existsSync(d)).flatMap(walk).filter((f) => f.endsWith('.js'));
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) errors.push(`${f}\n${r.stderr}`);
}
for (const f of jsonFiles) {
  if (!fs.existsSync(f)) continue;
  try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`${f}: ${e.message}`); }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${jsFiles.length} JS-filer och ${jsonFiles.length} JSON-filer`);
