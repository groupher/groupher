import F from '../fragments'

const docPublicTreeNode = `
  id
  groupId
  docId
  type
  title
  slug
  index
  href
  marker {
    type
    provider
    name
    src
    unified
  }
  badge
`

export const doc = `
  query doc($article: ArticlePathInput!, $userHasLogin: Boolean!) {
    doc(article: $article) {
      ${F.article}
      subtitle
      ${F.articleDetail}
    }
  }
`
export const docPublicTree = `
  query docPublicTree($community: String!) {
    docPublicTree(community: $community) {
      groups {
        ${docPublicTreeNode}
        children {
          ${docPublicTreeNode}
        }
      }
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
