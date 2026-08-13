/**
 * Implements the Vite.config boundary inside Inspire Me.
 *
 * Business position:
 *
 *   Research dataset
 *     -> Inspire Me module
 *     -> Vinext / Worker UI
 *     -> researcher
 */

import { cloudflare } from '@cloudflare/vite-plugin'
import { cdnAdapter } from '@vinext/cloudflare/cache/cdn-adapter'
import { defineConfig } from 'vite'
import vinext from 'vinext'

export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: 'rsc',
        childEnvironments: ['ssr'],
      },
    }),
  ],
})
