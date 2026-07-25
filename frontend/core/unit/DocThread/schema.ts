import { gql } from 'urql'

const docPublicTreeMarkerFields = gql`
  fragment docPublicTreeMarkerFields on Marker {
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
`

const docPublicTreeNodeFields = gql`
  fragment docPublicTreeNodeFields on DocPublicTreeNode {
    id
    parentNodeId
    docId
    type
    title
    index
    href
    marker {
      ...docPublicTreeMarkerFields
    }
    badge
  }
`

const docPublicTreeNodeSelection = (depth: number): string => `
  ...docPublicTreeNodeFields
  ${depth > 0 ? `pages { ${docPublicTreeNodeSelection(depth - 1)} }` : ''}
`

const docPublicTree = gql`
  query docPublicTree($community: String!) {
    docPublicTree(community: $community) {
      tabs {
        ...docPublicTreeNodeFields
        pins {
          ...docPublicTreeNodeFields
        }
        groups {
          ${docPublicTreeNodeSelection(12)}
        }
      }
    }
  }
  ${docPublicTreeMarkerFields}
  ${docPublicTreeNodeFields}
`

const schema = {
  docPublicTree,
}

export default schema
