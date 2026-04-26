import { gql } from 'urql'

import { F } from '~/schemas'

import { pagedChangelogs } from '../../schemas/pages/changelog'
import { pagedCommunityTags as pagedCommunityTagsQuery } from '../../schemas/pages/misc'
import { pagedPosts } from '../../schemas/pages/post'

const PAGED_ARTICLE_SCHEMA = {
  post: pagedPosts,
  changelog: pagedChangelogs,
}

const getPagedArticlesSchema = (thread) => {
  return gql`
    ${PAGED_ARTICLE_SCHEMA[thread]}
  `
}

const getArticleFreshSchema = () => {
  // TODO: commentParticipants
  return gql`
    query post($article: ArticleRefInput!, $userHasLogin: Boolean!) {
      post(article: $article) {
        id
        views
        upvotesCount
        commentsCount
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
    }
  `
}

const pagedCommunityTags = gql`
  ${pagedCommunityTagsQuery}
`

const schema = {
  pagedCommunityTags,
  getPagedArticlesSchema,
  getArticleFreshSchema,
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
}

export default schema
