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
import vinext from 'vinext'
import { defineConfig } from 'vite'

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
