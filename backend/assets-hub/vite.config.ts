/**
 * Connects the Assets Hub Worker entrypoint to Cloudflare's Vite build output.
 *
 * Vite -> Cloudflare plugin -> deployable Worker bundle
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [cloudflare()] })
