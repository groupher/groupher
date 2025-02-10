import F from '../fragments'

export const doc = `
  query doc($community: String!, $id: ID!, $userHasLogin: Boolean!) {
    doc(community: $community, id: $id) {
      ${F.article}
      ${F.articleDetail}
    }
  }
`
export const pagedDocs = `
  query($filter: PagedDocsFilter, $userHasLogin: Boolean!) {
    pagedDocs(filter: $filter) {
      entries {
        ${F.article}
        meta {
          thread
          latestUpvotedUsers {
            ${F.author}
          }
        }
        commentsParticipants {
          ${F.author}
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ${F.pagi}
    }
  }
`
