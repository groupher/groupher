import { graphql } from '~/graphql/authoring'

export const PageDocPublicTreeNodeFields = graphql(`
  fragment PageDocPublicTreeNodeFields on DocPublicTreeNode {
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
  }
`)

export const PageDocPublicTreeChildFields = graphql(`
  fragment PageDocPublicTreeChildFields on DocPublicTreeNode {
    ...PageDocPublicTreeNodeFields
    pages {
      ...PageDocPublicTreeNodeFields
    }
  }
`)

export const PageDocPublicTreeGroupFields = graphql(`
  fragment PageDocPublicTreeGroupFields on DocPublicTreeNode {
    ...PageDocPublicTreeNodeFields
    pages {
      ...PageDocPublicTreeChildFields
    }
  }
`)
