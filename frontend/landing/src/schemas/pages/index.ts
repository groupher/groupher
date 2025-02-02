import { pagedPosts, pagedPublishedPosts, post, groupedKanbanPosts } from './post'
import { pagedDocs, doc } from './doc'
import { pagedChangelogs, changelog } from './changelog'

import { user, sessionState } from './user'
import { community, subscribedCommunities, pagedCommunities } from './community'
import { pagedComments } from './comment'
import { pagedCategories, pagedArticleTags } from './misc'
import { mentions } from './mail'

import { reaction, undoReaction, setTag, unsetTag, follow, undoFollow } from './action'

const P = {
  community,
  subscribedCommunities,
  pagedCommunities,
  groupedKanbanPosts,
  // comment
  pagedComments,
  // misc
  pagedCategories,
  pagedArticleTags,
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
  user,
  sessionState,
  // action
  // mentions
  mentions,
  reaction,
  undoReaction,
  setTag,
  unsetTag,
  follow,
  undoFollow,
}

export default P
