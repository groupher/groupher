export type FeedbackRouteSearch = { page?: string }

/** Keeps arbitrary page input so the loader can preserve the legacy parseInt contract. */
export function validateFeedbackSearch(search: Record<string, unknown>): FeedbackRouteSearch {
  return typeof search.page === 'string' ? { page: search.page } : {}
}
