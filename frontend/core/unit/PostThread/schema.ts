import { pagedChangelogs } from '../../schemas/pages/changelog'
import { communityTagStats as communityTagStatsQuery } from '../../schemas/pages/misc'
import { pagedPosts } from '../../schemas/pages/post'

const PAGED_ARTICLE_SCHEMA = {
  post: pagedPosts,
  changelog: pagedChangelogs,
}

const getPagedArticlesSchema = (thread) => {
  return PAGED_ARTICLE_SCHEMA[thread]
}

const communityTagStats = communityTagStatsQuery

const schema = {
  communityTagStats,
  getPagedArticlesSchema,
}

export default schema
