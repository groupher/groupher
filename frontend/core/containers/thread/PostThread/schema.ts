import { gql } from 'urql'
import { P, F } from '~/schemas'

import { plural } from '~/fmt'

const getPagedArticlesSchema = (thread) => {
  return gql`
    ${P[`paged${plural(thread, 'titleCase')}`]}
  `
}

const getArticleFreshSchema = () => {
  // TODO: commentParticipants
  return gql`
    query post($id: ID!, $userHasLogin: Boolean!) {
      post(id: $id) {
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

const pagedArticleTags = gql`
  ${P.pagedArticleTags}
`

const schema = {
  pagedArticleTags,
  getPagedArticlesSchema,
  getArticleFreshSchema,
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
}

export default schema
