/**
 * Converter Cloudflare runtime boundary.
 *
 * Vite -> Cloudflare plugin -> Worker build
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  // Managed local runs consume Hub-injected values, not project dotenv files.
  envDir: process.env.DEV_HUB_MANAGED_ENVIRONMENT === 'true' ? false : undefined,
  plugins: [cloudflare({ types: { includeRuntime: false } })],
  server: { host: '127.0.0.1', port: 8000, strictPort: true },
})
