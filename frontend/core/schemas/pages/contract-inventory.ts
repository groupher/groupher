import { follow, setTag, undoFollow, unsetTag } from './action'
import { changelog, changelogPage } from './changelog'
import { commentPage } from './comment'
import { community, pagedCommunities, subscribedCommunities } from './community'
import { doc, docPublicTree, docPage } from './doc'
import { communityTagGroups, communityTagStats, categories, themePresets } from './misc'
import { postPage, pagedPublishedPosts, post } from './post'
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
  commentPage,
  categories,
  themePresets,
  communityTagGroups,
  communityTagStats,
  postPage,
  pagedPublishedPosts,
  post,
  changelogPage,
  changelog,
  docPage,
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
