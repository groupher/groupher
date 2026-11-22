import { graphql } from '~/graphql/authoring'

export const DocPublicTreeNodeFields = graphql(`
  fragment DocPublicTreeNodeFields on DocPublicTreeNode {
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

export const DocPublicTreeChildFields = graphql(`
  fragment DocPublicTreeChildFields on DocPublicTreeNode {
    ...DocPublicTreeNodeFields
    pages {
      ...DocPublicTreeNodeFields
    }
  }
`)

export const DocPublicTreeGroupFields = graphql(`
  fragment DocPublicTreeGroupFields on DocPublicTreeNode {
    ...DocPublicTreeNodeFields
    pages {
      ...DocPublicTreeChildFields
    }
  }
`)
