const DASHBOARD_ASSET_PREFIX = process.env.NODE_ENV === 'production' ? '/dashboard' : ''

/** Returns integration icon src for the frontend shared workflow. */
export const getIntegrationIconSrc = (key: string): string =>
  `${DASHBOARD_ASSET_PREFIX}/integrations/${key}.png`
