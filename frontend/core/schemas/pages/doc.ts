import { DOC_TREE_MAX_DEPTH } from '~/const/dsb/docs'

import F from '../fragments'

const docPublicTreeNode = `
  id
  parentNodeId
  docId
  type
  title
  index
  href
  marker {
    type
    provider
    name
    src
    unified
    appearance {
      light {
        color
        bg
      }
      dark {
        color
        bg
      }
    }
  }
  badge
`

const docPublicTreeNodeSelection = (depth: number): string => `
  ${docPublicTreeNode}
  ${depth > 0 ? `pages { ${docPublicTreeNodeSelection(depth - 1)} }` : ''}
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
      tabs {
        ${docPublicTreeNode}
        pins { ${docPublicTreeNode} }
        groups {
          ${docPublicTreeNodeSelection(DOC_TREE_MAX_DEPTH)}
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
