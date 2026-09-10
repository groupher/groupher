import { graphql } from '~/graphql/authoring'

export const changelog = graphql(`
  query Changelog($article: ArticlePathInput!, $userHasLogin: Boolean!, $viewEventId: ID) {
    changelog(article: $article, viewEventId: $viewEventId) {
      ...PageChangelogFields
      ...PageChangelogDetailFields
    }
  }
`)

export const pagedChangelogs = graphql(`
  query PagedChangelogs($filter: PagedChangelogsFilter!, $userHasLogin: Boolean!) {
    pagedChangelogs(filter: $filter) {
      entries {
        ...PageChangelogFields
        meta {
          thread
          latestUpvotedUsers {
            ...PageCommonUserFields
          }
        }
        digest
        linkAddr
        commentsParticipants {
          ...PageAuthorFields
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ...PageChangelogPageInfo
    }
  }
`)
