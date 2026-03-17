export type TPreviewIdentity = {
  communitySlug: string
  thread: string
  innerId: string
}

export type TPreviewPhase = 'cached-lite' | 'cached-full' | 'live'

export type TPreviewCacheEntryBase = TPreviewIdentity & {
  key: string
  cachedAt: number
}
