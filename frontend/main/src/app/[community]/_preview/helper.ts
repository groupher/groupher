export const getPreviewCacheKey = (
  communitySlug: string,
  thread: string,
  innerId: number | string,
) => `${communitySlug}:${thread}:${innerId}`
