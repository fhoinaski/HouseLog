import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      '@houselog/contracts': fileURLToPath(
        new URL('../../../packages/contracts/src/index.ts', import.meta.url)
      ),
    },
  },
});
