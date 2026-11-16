import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataOut = resolve(root, 'public', 'data');
const docsOut = resolve(root, 'public', 'docs');
const version = 'v1';
const files = ['gpus', 'models', 'quantizations', 'engines', 'cpus'];
const docs = ['README.md', 'ASSUMPTIONS.md', 'DATA_SOURCES.md', 'LICENSE'];

await mkdir(dataOut, { recursive: true });
for (const name of files) {
  await copyFile(resolve(root, 'data', `${name}.json`), resolve(dataOut, `${name}.${version}.json`));
}

await mkdir(docsOut, { recursive: true });
for (const name of docs) {
  await copyFile(resolve(root, name), resolve(docsOut, name));
}

console.log(`[prepare:data] ${files.length} каталогов скопированы в public/data (${version})`);
console.log(`[prepare:data] ${docs.length} документов скопированы в public/docs`);
