const rawBase = process.argv[2];
if (!rawBase) {
  console.error('Usage: node scripts/remote-smoke.mjs <page-url>');
  process.exit(1);
}

const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
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

const attempts = 10;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  let failed = false;
  for (const route of routes) {
    try {
      const response = await fetch(route, { redirect: 'follow' });
      const ok = response.status === 200;
      console.log(`${ok ? '✓' : '✗'} ${route} → ${response.status}`);
      if (!ok) failed = true;
    } catch (error) {
      console.log(`✗ ${route} → ${error instanceof Error ? error.message : error}`);
      failed = true;
    }
  }
  if (!failed) {
    console.log('✓ Живой smoke GitHub Pages пройден');
    process.exit(0);
  }
  if (attempt < attempts) {
    console.log(`… повтор через 5 с (${attempt}/${attempts})`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
console.error('✗ Живой smoke GitHub Pages не прошёл');
process.exit(1);
