#!/usr/bin/env node
import { build } from 'esbuild';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const targets = [
  { in: 'public/v36.js', out: 'public/v36.min.js' },
];

const fmt = (n) => (n / 1024).toFixed(1) + ' kB';

for (const t of targets) {
  const inPath = resolve(root, t.in);
  const outPath = resolve(root, t.out);

  const srcSize = (await stat(inPath)).size;
  const code = await readFile(inPath, 'utf8');

  await build({
    stdin: { contents: code, sourcefile: t.in, loader: 'js' },
    outfile: outPath,
    minify: true,
    target: ['es2019'],
    legalComments: 'none',
    bundle: false,
    sourcemap: false,
    logLevel: 'info',
  });

  const outSize = (await stat(outPath)).size;
  const saved = (1 - outSize / srcSize) * 100;
  console.log(`  ${t.in} -> ${t.out}  ${fmt(srcSize)} -> ${fmt(outSize)}  (-${saved.toFixed(1)}%)`);
}
