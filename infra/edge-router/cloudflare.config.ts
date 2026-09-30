import { bindings, defineConfig, triggers } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const local = mode === 'local'

  return {
    worker: {
      name: local ? 'edge-router-local' : 'edge-router',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: 'src/index.ts',
      workersDev: local,
      previewUrls: local ? undefined : true,
      observability: local ? undefined : observability,
      triggers: local
        ? undefined
        : [
            triggers.fetch({
              pattern: 'groupher.com/*',
              zone: 'bd0b41b1b0c3775bd45228dda8567d93',
            }),
            triggers.fetch({
              pattern: 'www.groupher.com/*',
              zone: 'bd0b41b1b0c3775bd45228dda8567d93',
            }),
          ],
      env: {
        API_SITE: bindings.text(local ? 'http://127.0.0.1:4001' : 'https://api.groupher.com'),
        PRESS_SITE: bindings.text(local ? 'http://127.0.0.1:8003' : 'https://press.groupher.com'),
        CUSTOM_DOMAIN_COMMUNITIES: bindings.text('{}'),
        NODE_ENV: bindings.text(local ? 'development' : 'production'),
        LANDING: bindings.worker({ worker: 'landing' }),
        COMMUNITY: bindings.worker({ worker: 'community' }),
        AUTH: bindings.worker({ worker: 'auth' }),
        CF_VERSION_METADATA: bindings.versionMetadata(),
      },
    },
  }
})
