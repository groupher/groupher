import type { TServiceHealthResponseV1 } from '@groupher/contracts/health'

const isolateStartedAt = Date.now()

type THealthOptions = {
  environment?: string
  now?: Date
  uptimeMs?: number
  version?: string
}

/** Builds health.v1; uptime is scoped to the current Cloudflare isolate, not the deployment. */
export const buildCommunityHealth = (options: THealthOptions = {}): TServiceHealthResponseV1 => ({
  schemaVersion: 'health.v1',
  status: 'ok',
  service: 'community',
  version: options.version || import.meta.env.VITE_GIT_COMMIT_SHA || 'dev',
  environment: options.environment || import.meta.env.MODE || 'development',
  timestamp: (options.now || new Date()).toISOString(),
  uptimeMs: options.uptimeMs ?? Math.max(0, Date.now() - isolateStartedAt),
  checks: [],
})
