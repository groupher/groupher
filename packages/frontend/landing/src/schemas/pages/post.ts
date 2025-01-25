import F from '../fragments'

export const post = `
  query post($community: String!, $id: ID!, $userHasLogin: Boolean!) {
    post(community: $community, id: $id) {
      ${F.article}
      ${F.articleDetail}
    }
  }
`
export const pagedPosts = `
  query($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {
    pagedPosts(filter: $filter) {
      entries {
        ${F.article}
        cat
        state
        meta {
          thread
          latestUpvotedUsers {
            ${F.author}
          }
        }
        digest
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

export const pagedPublishedPosts = `
  query($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {
    pagedPublishedPosts(login: $login, filter: $filter) {
      entries {
        ${F.article}
        meta {
          thread
        }
        digest
        linkAddr
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

export const groupedKanbanPosts = `
  query groupedKanbanPosts($community: String!) {
    groupedKanbanPosts(community: $community) {
      todo {
        entries {
          innerId
          cat
          state
          title
          originalCommunitySlug
          meta {
            thread
          }
          author {
            ${F.author}
          }
        }
        ${F.pagi}
      }

      wip {
        entries {
          innerId
          cat
          state
          title
          originalCommunitySlug
          meta {
            thread
          }
          author {
            ${F.author}
          }
        }
        ${F.pagi}
      }

      done {
        entries {
          innerId
          cat
          state
          title
          originalCommunitySlug
          meta {
            thread
          }
          author {
            ${F.author}
          }
        }
        ${F.pagi}
      }
    }
  }
`
