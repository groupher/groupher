export type TPreviewIdentity = {
  communitySlug: string
  thread: string
  innerId: string
}

export type TPreviewCacheEntryBase = TPreviewIdentity & {
  key: string
  cachedAt: number
}
