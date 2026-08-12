import { graphql } from '~/graphql/authoring'

export const post = graphql(`
  query Post($article: ArticlePathInput!, $userHasLogin: Boolean!) {
    post(article: $article) {
      ...PagePostFields
      ...PagePostDetailFields
    }
  }
`)

export const pagedPosts = graphql(`
  query PagedPosts($filter: PagedPostsFilter!, $userHasLogin: Boolean!) {
    pagedPosts(filter: $filter) {
      entries {
        ...PagePostFields
        cat
        status
        meta {
          thread
          latestUpvotedUsers {
            ...PageCommonUserFields
          }
        }
        digest
        commentsParticipants {
          ...PageAuthorFields
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ...PagePostPageInfo
    }
  }
`)

export const pagedPublishedPosts = graphql(`
  query PagedPublishedPosts($login: String!, $filter: PagiFilter!, $userHasLogin: Boolean!) {
    pagedPublishedPosts(login: $login, filter: $filter) {
      entries {
        ...PagePostFields
        meta {
          thread
        }
        digest
        linkAddr
        commentsParticipants {
          ...PageAuthorFields
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ...PagePostPageInfo
    }
  }
`)

export const groupedKanbanPosts = graphql(`
  query PagesGroupedKanbanPosts($community: String!) {
    groupedKanbanPosts(community: $community) {
      backlog {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...PageAuthorFields
          }
        }
        ...PagePostPageInfo
      }
      todo {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...PageAuthorFields
          }
        }
        ...PagePostPageInfo
      }
      wip {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...PageAuthorFields
          }
        }
        ...PagePostPageInfo
      }
      done {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...PageAuthorFields
          }
        }
        ...PagePostPageInfo
      }
      rejected {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...PageAuthorFields
          }
        }
        ...PagePostPageInfo
      }
    }
  }
`)
