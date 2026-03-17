import { THREAD } from '~/const/thread'
import type { TChangelog, TPagedComments } from '~/spec'

import { getPreviewCacheKey, type TPreviewCacheEntryBase, type TPreviewIdentity } from '../_preview'

export type TChangelogPreviewCacheEntry = TPreviewCacheEntryBase & {
  articleInitData: { changelog: TChangelog | null; thread: typeof THREAD.CHANGELOG }
  commentsInitData:
    | { pagedComments: TPagedComments; totalCount: number; initialized: true }
    | { initialized: false }
}

type TArgs = TPreviewIdentity & {
  changelog: TChangelog | null
  pagedComments: TPagedComments | null
}

/**
 * Preview cache stores the init snapshots used to recreate the same provider
 * tree later. It intentionally caches data inputs, not mounted components.
 */
export default function buildPreviewCacheEntry({
  communitySlug,
  thread,
  innerId,
  pagedComments,
  changelog,
}: TArgs): TChangelogPreviewCacheEntry {
  return {
    key: getPreviewCacheKey(communitySlug, thread, innerId),
    communitySlug,
    thread,
    innerId,
    articleInitData: { changelog, thread: THREAD.CHANGELOG },
    commentsInitData: pagedComments
      ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
      : { initialized: false },
    cachedAt: Date.now(),
  }
}
