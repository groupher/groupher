import type {
  TThirdPartyAnalyticsConfig,
  TThirdPartyAnalyticsField,
  TThirdPartyAnalyticsProvider,
} from './types'

export type {
  TThirdPartyAnalyticsConfig,
  TThirdPartyAnalyticsField,
  TThirdPartyAnalyticsProvider,
} from './types'

export const THIRD_PARTY_ANALYTICS_FIELDS: Record<
  TThirdPartyAnalyticsProvider,
  TThirdPartyAnalyticsField
> = {
  ga: 'measurementId',
  gtm: 'containerId',
  clarity: 'projectId',
  plausible: 'domain',
  fathom: 'siteId',
}

const PATTERNS: Record<TThirdPartyAnalyticsProvider, RegExp> = {
  ga: /^G-[A-Za-z0-9-]+$/,
  gtm: /^GTM-[A-Za-z0-9-]+$/,
  clarity: /^[A-Za-z0-9_-]+$/,
  plausible: /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/,
  fathom: /^[A-Za-z0-9_-]+$/,
}

const MAX_VALUE_LENGTH = 255

/** Returns third party analytics value for the frontend shared workflow. */
export const getThirdPartyAnalyticsValue = (config: TThirdPartyAnalyticsConfig): string => {
  const field = THIRD_PARTY_ANALYTICS_FIELDS[config.provider]

  return String(config[field] ?? '').trim()
}

/** Reports whether valid third party analytics config at the frontend shared boundary. */
export const isValidThirdPartyAnalyticsConfig = (config: TThirdPartyAnalyticsConfig): boolean => {
  if (!config.enabled) return false

  const value = getThirdPartyAnalyticsValue(config)
  if (!value) return false
  if (value.length > MAX_VALUE_LENGTH) return false

  return PATTERNS[config.provider].test(value)
}

/** Returns renderable third party analytics configs for the frontend shared workflow. */
export const getRenderableThirdPartyAnalyticsConfigs = (
  configs: readonly TThirdPartyAnalyticsConfig[] = [],
): readonly TThirdPartyAnalyticsConfig[] => configs.filter(isValidThirdPartyAnalyticsConfig)
