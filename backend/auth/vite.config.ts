/**
 * Connects the Auth Worker entrypoint to Cloudflare's Vite build output.
 *
 * Vite -> Cloudflare plugin -> deployable Auth Worker bundle
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [cloudflare()] })
