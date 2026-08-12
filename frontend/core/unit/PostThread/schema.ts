import { graphql } from '~/graphql/authoring'

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

const getArticleFreshSchema = () => {
  // TODO: commentParticipants
  return graphql(`
    query PostThreadFresh($article: ArticlePathInput!, $userHasLogin: Boolean!) {
      post(article: $article) {
        innerId
        views
        upvotesCount
        commentsCount
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
    }
  `)
}

const communityTagStats = communityTagStatsQuery

const schema = {
  communityTagStats,
  getPagedArticlesSchema,
  getArticleFreshSchema,
}

export default schema
