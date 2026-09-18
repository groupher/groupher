export const ARTICLE_STATS_POLICY_VERSION = 1

export const ARTICLE_STATS_CACHE_POLICY = {
  publicHtmlSMaxageSeconds: 600,
  publicHtmlSwrSeconds: 300,
  snapshotMaxAgeSeconds: 600,
  clockSkewToleranceSeconds: 120,
  policyVersion: ARTICLE_STATS_POLICY_VERSION,
} as const

export const CONFIRMED_WRITE_RECEIPT_TTL_MS =
  (ARTICLE_STATS_CACHE_POLICY.publicHtmlSMaxageSeconds +
    ARTICLE_STATS_CACHE_POLICY.publicHtmlSwrSeconds +
    60) *
  1_000
