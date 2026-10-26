import { bindings, defineConfig, triggers } from 'cf/config'

const observability = {
  enabled: true,
  logs: { headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const

export default defineConfig(({ mode }) => {
  const local = mode === 'development'
  const preview = mode === 'preview'
  const setting = (name: string, productionFallback: string): string => {
    const configured = process.env[name]
    if (preview && !configured) throw new Error(`${name} is required for isolated edge-router preview`)
    return configured || productionFallback
  }

  return {
    worker: {
      name: local ? 'edge-router-local' : preview ? 'edge-router-preview' : 'edge-router',
      compatibilityDate: '2026-08-06',
      compatibilityFlags: ['nodejs_compat'],
      entrypoint: 'src/index.ts',
      workersDev: local || preview,
      previewUrls: local ? undefined : true,
      observability: local ? undefined : observability,
      triggers:
        local || preview
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
        API_SITE: bindings.text(
          local
            ? process.env.API_SITE || 'http://127.0.0.1:4001'
            : setting('API_SITE', 'https://api.groupher.com'),
        ),
        PRESS_PUBLIC_DISABLED: bindings.text(
          local ? 'false' : process.env.PRESS_PUBLIC_DISABLED || 'true',
        ),
        CUSTOM_DOMAIN_COMMUNITIES: bindings.text(process.env.CUSTOM_DOMAIN_COMMUNITIES || '{}'),
        PREVIEW_PLATFORM_HOSTS: bindings.text(
          preview ? setting('PREVIEW_PLATFORM_HOSTS', '') : process.env.PREVIEW_PLATFORM_HOSTS || '',
        ),
        NODE_ENV: bindings.text(local ? 'development' : preview ? 'preview' : 'production'),
        LANDING: bindings.worker({ worker: 'landing' }),
        COMMUNITY: bindings.worker({ worker: 'community' }),
        AUTH: bindings.worker({ worker: 'auth' }),
        PRESS: bindings.worker({
          worker: local ? 'press-local' : preview ? 'press-preview' : 'press',
          exportName: 'Public',
        }),
        CF_VERSION_METADATA: bindings.versionMetadata(),
      },
    },
  }
})
