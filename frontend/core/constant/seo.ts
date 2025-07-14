import type { TSEOFields } from '~/stores/dashboard/spec'

export const SEO_OG_KEYS: TSEOFields[] = [
  'ogSiteName',
  'ogTitle',
  'ogDescription',
  'ogUrl',
  'ogImage',
  // not sync with backend, not not add
  // 'ogLocale',
  // 'ogPublisher',
]

export const SEO_TW_KEYS: TSEOFields[] = [
  'twTitle',
  'twDescription',
  'twUrl',
  'twCard',
  'twSite',
  'twImage',
  'twImageWidth',
  'twImageHeight',
]

export const SEO_KEYS: TSEOFields[] = ['seoEnable', ...SEO_OG_KEYS, ...SEO_TW_KEYS]
