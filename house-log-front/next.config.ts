import type { NextConfig } from 'next';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = dirname(appRoot);
const contractsEntry = join(monorepoRoot, 'packages', 'contracts', 'src', 'index.ts');
const zodModule = join(appRoot, 'node_modules', 'zod');
const turbopackContractsEntry = '../packages/contracts/src/index.ts';
const turbopackZodModule = './node_modules/zod';

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      '@houselog/contracts': turbopackContractsEntry,
      zod: turbopackZodModule,
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@houselog/contracts': contractsEntry,
      zod: zodModule,
    };

    return config;
  },
  images: {
    remotePatterns: [
      // Allow R2 public bucket images
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
