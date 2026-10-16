import { defineConfig } from 'vitest/config';
import { e2eDatabaseUrl } from './test/utils/e2e-env.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globalSetup: ['./test/utils/e2e-global-setup.ts'],
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      REDIS_DB: '1',
      QUEUE_PREFIX: 'bull-e2e',
      PAYMENT_MOCK_DELAY_MS: '500',
      ORDER_RECOVERY_INTERVAL_SECONDS: '0',
    },
  },
});
