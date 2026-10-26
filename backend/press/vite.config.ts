/**
 * Configures Vite for local Worker development and production builds.
 *
 * Business position:
 *
 *   Press sources
 *     -> Cloudflare Vite plugin
 *     -> Worker build
 */
import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [cloudflare()] })
