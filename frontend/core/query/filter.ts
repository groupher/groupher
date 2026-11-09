import type { PostFilter } from '~/graphql/generated/graphql'
import type { TPagedArticlesParams } from '~/spec'

import { normalizeArticleFilter } from './key'

/** Builds the domain-only filter required by the shared Article page contract. */
export const toArticlePageFilter = (filter: TPagedArticlesParams): PostFilter => {
  const normalized = normalizeArticleFilter(filter)

  return {
    community: normalized.community,
    ...(normalized.communityTag ? { communityTag: normalized.communityTag } : {}),
    ...(normalized.communityTags.length > 0 ? { communityTags: normalized.communityTags } : {}),
    ...(normalized.cat ? { cat: normalized.cat as PostFilter['cat'] } : {}),
    ...(normalized.order ? { order: normalized.order as PostFilter['order'] } : {}),
    ...(normalized.when ? { when: normalized.when as PostFilter['when'] } : {}),
    ...(normalized.sort ? { sort: normalized.sort as PostFilter['sort'] } : {}),
  }
}
