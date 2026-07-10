import { gql } from 'urql'

const docPublicTreeMarkerFields = gql`
  fragment docPublicTreeMarkerFields on Marker {
    type
    provider
    name
    src
    unified
  }
`

const docPublicTreeNodeFields = gql`
  fragment docPublicTreeNodeFields on DocPublicTreeNode {
    id
    groupId
    docId
    type
    title
    slug
    index
    href
    marker {
      ...docPublicTreeMarkerFields
    }
    badge
  }
`

const docPublicTree = gql`
  query docPublicTree($community: String!) {
    docPublicTree(community: $community) {
      groups {
        ...docPublicTreeNodeFields
        children {
          ...docPublicTreeNodeFields
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
