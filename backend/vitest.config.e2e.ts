import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      QUEUE_PREFIX: 'bull-e2e',
      PAYMENT_MOCK_DELAY_MS: '500',
      ORDER_RECOVERY_INTERVAL_SECONDS: '0',
    },
  },
});
