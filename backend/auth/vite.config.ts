/**
 * Connects the Auth Worker entrypoint to Cloudflare's Vite build output.
 *
 * Vite -> Cloudflare plugin -> deployable Auth Worker bundle
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  // Managed local runs consume Hub-injected values, not project dotenv files.
  envDir: process.env.DEV_HUB_MANAGED_ENVIRONMENT === 'true' ? false : undefined,
  plugins: [cloudflare({ types: { includeRuntime: false } })],
})
