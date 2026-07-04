import { follow, setTag, undoFollow, unsetTag } from './action'
import { changelog, pagedChangelogs } from './changelog'
import { pagedComments } from './comment'
import { community, pagedCommunities, subscribedCommunities } from './community'
import { doc, pagedDocs } from './doc'
import { mentions } from './mail'
import { communityTagGroups, communityTagStats, pagedCategories, themePresets } from './misc'
import { groupedKanbanPosts, pagedPosts, pagedPublishedPosts, post } from './post'
import { me, sessionState, user } from './user'

const P = {
  community,
  subscribedCommunities,
  pagedCommunities,
  groupedKanbanPosts,
  // comment
  pagedComments,
  // misc
  pagedCategories,
  themePresets,
  communityTagGroups,
  communityTagStats,
  // post
  pagedPosts,
  pagedPublishedPosts,
  post,
  // changelog
  pagedChangelogs,
  changelog,
  // doc
  pagedDocs,
  doc,
  // user
  me,
  user,
  sessionState,
  // action
  // mentions
  mentions,
  setTag,
  unsetTag,
  follow,
  undoFollow,
}

export default P
