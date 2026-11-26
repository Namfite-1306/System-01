import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = [
  'server.mjs',
  ...['api', 'lib', 'dist', 'src', 'scripts', 'test'].flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => /\.(mjs|js)$/.test(name))
      .map((name) => `${dir}/${name}`),
  ),
];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax OK: ${files.length} files`);
