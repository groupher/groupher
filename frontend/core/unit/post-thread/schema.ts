import { gql } from 'urql'
import { plural } from '~/fmt'
import { F, P } from '~/schemas'

const getPagedArticlesSchema = (thread) => {
  return gql`
    ${P[`paged${plural(thread, 'titleCase')}`]}
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
  ${P.pagedCommunityTags}
`

const schema = {
  pagedCommunityTags,
  getPagedArticlesSchema,
  getArticleFreshSchema,
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
}

export default schema
