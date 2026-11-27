/**
 * Checks the Assets Hub runtime boundary before provider execution.
 *
 *   process or Worker configuration -> runtime policy -> Assets Hub provider
 */

/** Reject local-only providers and service addresses in production runtimes. */
export function validateProductionAssetsEnvironment(
  environment: Record<string, string | undefined>,
): void {
  if (environment.NODE_ENV !== 'production' && environment.ENVIRONMENT !== 'production') return
  if (environment.ASSETS_HUB_RUNTIME === 'local')
    throw new Error('ASSETS_HUB_RUNTIME=local is unavailable in production.')
  for (const key of [
    'PHOENIX_GRAPHQL_ENDPOINT',
    'SERVICE_AUTH_ISSUER',
    'SERVICE_AUTH_JWKS_URL',
    'SERVICE_AUTH_TOKEN_ENDPOINT',
    'ASSETS_R2_ENDPOINT',
  ]) {
    const value = environment[key]?.trim()
    if (!value) continue
    let host: string
    try {
      host = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    } catch {
      continue
    }
    if (
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.startsWith('127.') ||
      host === '::1'
    )
      throw new Error(`${key} must not target a local development service in production.`)
  }
}
