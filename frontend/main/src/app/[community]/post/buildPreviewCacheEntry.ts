import { THREAD } from '~/const/thread'
import type { TPagedComments, TPost } from '~/spec'

import type { TPreviewCacheEntry } from '../_preview/spec'

type TArgs = {
  communitySlug: string
  innerId: number
  post: TPost | null
  pagedComments: TPagedComments | null
}

export const getPreviewCacheKey = (
  communitySlug: string,
  thread: string,
  innerId: number | string,
) => `${communitySlug}:${thread}:${innerId}`

/**
 * Preview cache stores the init snapshots used to recreate the same provider
 * tree later. It intentionally caches data inputs, not mounted components.
 */
export default function buildPreviewCacheEntry({
  communitySlug,
  innerId,
  post,
  pagedComments,
}: TArgs): TPreviewCacheEntry {
  return {
    key: getPreviewCacheKey(communitySlug, THREAD.POST, innerId),
    communitySlug,
    thread: THREAD.POST,
    innerId,
    articleInitData: { post, thread: THREAD.POST },
    commentsInitData: pagedComments
      ? { pagedComments, totalCount: pagedComments.totalCount || 0, initialized: true }
      : { initialized: false },
    cachedAt: Date.now(),
  }
}
