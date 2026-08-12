import { follow, setTag, undoFollow, unsetTag } from './action'
import { changelog, pagedChangelogs } from './changelog'
import { pagedComments } from './comment'
import { community, pagedCommunities, subscribedCommunities } from './community'
import { doc, docPublicTree, pagedDocs } from './doc'
import { communityTagGroups, communityTagStats, pagedCategories, themePresets } from './misc'
import { groupedKanbanPosts, pagedPosts, pagedPublishedPosts, post } from './post'
import { me, sessionState, user } from './user'

/**
 * Explicit Pages contract inventory for schema tests only.
 *
 * This is intentionally not exported from `~/schemas` and is not a runtime
 * lookup registry. Production callers import the operation they need directly
 * from its owning page module.
 */
export const pageDocuments = {
  community,
  subscribedCommunities,
  pagedCommunities,
  groupedKanbanPosts,
  pagedComments,
  pagedCategories,
  themePresets,
  communityTagGroups,
  communityTagStats,
  pagedPosts,
  pagedPublishedPosts,
  post,
  pagedChangelogs,
  changelog,
  pagedDocs,
  doc,
  docPublicTree,
  me,
  user,
  sessionState,
  setTag,
  unsetTag,
  follow,
  undoFollow,
} as const
