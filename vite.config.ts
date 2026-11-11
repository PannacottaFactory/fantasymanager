import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset path relative, so the build works on GitHub Pages
// under /fantasymanager/ as well as locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Season-long simulations are slow on CI machines.
    testTimeout: 120000,
  },
});
