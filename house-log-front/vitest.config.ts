import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Node environment — sem DOM. IndexedDB é polyfillado via fake-indexeddb nos testes.
    environment: 'node',
    globals: true,
    // Exclui testes E2E do Playwright — eles usam outro runner e outra API.
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
