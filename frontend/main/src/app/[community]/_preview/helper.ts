/** Returns preview cache key for the frontend shared workflow. */
export const getPreviewCacheKey = (
  communitySlug: string,
  thread: string,
  innerId: number | string,
) => `${communitySlug}:${thread}:${innerId}`
