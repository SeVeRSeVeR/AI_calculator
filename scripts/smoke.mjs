import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'dist');
const base = (process.env.VITE_BASE ?? '/').replace(/\/?$/, '/');
const port = Number(process.env.SMOKE_PORT ?? 4173);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (base !== '/' && pathname.startsWith(base)) pathname = pathname.slice(base.length - 1);
    let file = join(root, pathname);
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(root, '404.html');
    }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(500).end('smoke server error');
  }
});

await new Promise((resolvePromise) => server.listen(port, resolvePromise));

const routes = [
  base,
  `${base}?mode=b`,
  `${base}?mode=a&gpu=rtx4090&n=2&ctx=8192&u=10`,
  `${base}404.html`,
  `${base}robots.txt`,
  `${base}data/models.v1.json`,
  `${base}data/gpus.v1.json`,
  `${base}docs/README.md`,
  `${base}docs/ASSUMPTIONS.md`,
  `${base}docs/DATA_SOURCES.md`,
  `${base}docs/LICENSE`,
];
let failed = false;
for (const route of routes) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  const ok = response.status === 200;
  console.log(`${ok ? '✓' : '✗'} ${route} → ${response.status}`);
  if (!ok) failed = true;
}
server.close();
if (failed) process.exit(1);
console.log('✓ Smoke-проверка маршрутов пройдена');
