import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await copyFile(resolve(root, 'dist', 'index.html'), resolve(root, 'dist', '404.html'));
console.log('[postbuild] dist/404.html создан для GitHub Pages');
