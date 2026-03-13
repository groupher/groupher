import { THREAD } from '~/const/thread'
import type { TPagedComments, TPost } from '~/spec'

import { getPreviewCacheKey, type TPreviewCacheEntryBase, type TPreviewIdentity } from '../_preview'

export type TPostPreviewCacheEntry = TPreviewCacheEntryBase & {
  articleInitData: { post: TPost | null; thread: typeof THREAD.POST }
  commentsInitData:
    | { pagedComments: TPagedComments; totalCount: number; initialized: true }
    | { initialized: false }
}

type TArgs = TPreviewIdentity & {
  post: TPost | null
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
  post,
}: TArgs): TPostPreviewCacheEntry {
  return {
    key: getPreviewCacheKey(communitySlug, thread, innerId),
    communitySlug,
    thread,
    innerId,
    articleInitData: { post, thread: THREAD.POST },
    commentsInitData: pagedComments
      ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
      : { initialized: false },
    cachedAt: Date.now(),
  }
}
