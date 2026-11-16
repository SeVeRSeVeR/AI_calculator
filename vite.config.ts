import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __REPO_URL__: JSON.stringify(process.env.VITE_REPO_URL ?? ''),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
