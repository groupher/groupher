import type { TDsbFieldKey } from '~/unit/DashboardThread/spec'

export const SEO_OG_KEYS = [
  'ogSiteName',
  'ogTitle',
  'ogDescription',
  'ogUrl',
  'ogImage',
  // not sync with backend, not not add
  // 'ogLocale',
  // 'ogPublisher',
] as const

export const SEO_TW_KEYS = [
  'twTitle',
  'twDescription',
  'twUrl',
  'twCard',
  'twSite',
  'twImage',
  'twImageWidth',
  'twImageHeight',
] as const

export const SEO_KEYS = [
  'seoEnable',
  ...SEO_OG_KEYS,
  ...SEO_TW_KEYS,
] as const satisfies readonly TDsbFieldKey[]
