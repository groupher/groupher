import { graphql } from '~/graphql/authoring'

export const doc = graphql(`
  query PageDoc($article: ArticlePathInput!) {
    doc(article: $article) {
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
  query PagePagedDocs($filter: PagedDocsFilter!) {
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
      }
      ...PageDocPageInfo
    }
  }
`)
