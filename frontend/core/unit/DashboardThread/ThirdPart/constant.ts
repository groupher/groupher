const DASHBOARD_ASSET_PREFIX = process.env.NODE_ENV === 'production' ? '/dashboard' : ''

export const getIntegrationIconSrc = (key: string): string =>
  `${DASHBOARD_ASSET_PREFIX}/integrations/${key}.png`
