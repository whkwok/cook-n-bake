import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const directories = ['js', 'scripts'];
const files = directories.flatMap((directory) =>
  readdirSync(directory)
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
    .map((file) => `${directory}/${file}`)
);

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error(`Syntax check failed: ${file}`);
    console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax checks passed for ${files.length} JavaScript files.`);

const checks = [
  ['Knowledge base build', 'scripts/build-kb.mjs'],
  ['Course assistant evaluation', 'scripts/eval-course-assistant.mjs'],
  ['Static site build', 'scripts/build-site-static.mjs']
];

for (const [label, script] of checks) {
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8'
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    console.error(`${label} failed.`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(result.status ?? 1);
  }
}

console.log('All project checks passed.');
