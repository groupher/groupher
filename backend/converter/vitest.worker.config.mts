/**
 * Converter Cloudflare runtime boundary.
 *
 * Vitest -> workerd -> converter contract tests
 */
import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      experimental: { newConfig: { configPath: './cloudflare.test.config.ts' } },
    }),
  ],
  test: {
    fsModuleCache: false,
    include: ['src/**/*.worker.test.ts'],
  },
})
