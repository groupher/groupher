export const SEO_OG_KEYS = [
  'ogSiteName',
  'ogTitle',
  'ogDescription',
  'ogUrl',
  'ogImage',
  // not sync with backend, not not add
  // 'ogLocale',
  // 'ogPublisher',
]

export const SEO_TW_KEYS = [
  'twTitle',
  'twDescription',
  'twUrl',
  'twCard',
  'twSite',
  'twImage',
  'twImageWidth',
  'twImageHeight',
]

export const SEO_KEYS = ['seoEnable', ...SEO_OG_KEYS, ...SEO_TW_KEYS]
