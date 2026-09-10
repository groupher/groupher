import { graphql } from '~/graphql/authoring'

export const doc = graphql(`
  query PageDoc($article: ArticlePathInput!, $userHasLogin: Boolean!, $viewEventId: ID) {
    doc(article: $article, viewEventId: $viewEventId) {
      ...PageDocFields
      subtitle
      ...PageDocDetailFields
    }
  }
`)

export const docPublicTree = graphql(`
  query PageDocPublicTree($community: String!) {
    docPublicTree(community: $community) {
      tabs {
        ...PageDocPublicTreeNodeFields
        pins {
          ...PageDocPublicTreeNodeFields
        }
        groups {
          ...PageDocPublicTreeGroupFields
        }
      }
    }
  }
`)

export const pagedDocs = graphql(`
  query PagePagedDocs($filter: PagedDocsFilter!, $userHasLogin: Boolean!) {
    pagedDocs(filter: $filter) {
      entries {
        ...PageDocFields
        meta {
          thread
          latestUpvotedUsers {
            ...PageCommonUserFields
          }
        }
        commentsParticipants {
          ...PageAuthorFields
        }
        viewerHasViewed @include(if: $userHasLogin)
        viewerHasUpvoted @include(if: $userHasLogin)
      }
      ...PageDocPageInfo
    }
  }
`)
