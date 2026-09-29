import { graphql } from '~/graphql/authoring'

export const changelog = graphql(`
  query Changelog($article: ArticlePathInput!) {
    changelog(article: $article) {
      ...PageChangelogFields
      ...PageChangelogDetailFields
    }
  }
`)

export const pagedChangelogs = graphql(`
  query PagedChangelogs($filter: PagedChangelogsFilter!) {
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
      }
      ...PageChangelogPageInfo
    }
  }
`)
