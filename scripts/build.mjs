import { build } from 'esbuild';

await build({
  entryPoints: ['src/auth-client.js'],
  outfile: 'dist/auth-client.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  minify: true,
});
console.log('Built Supabase authentication client.');
