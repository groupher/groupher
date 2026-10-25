/**
 * Converter Cloudflare runtime boundary.
 *
 * Vite -> Cloudflare plugin -> Worker build
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [cloudflare()],
  server: { host: '127.0.0.1', port: 8000, strictPort: true },
})
