import { graphql } from '~/graphql/authoring'

export const DocCoverMarkerFields = graphql(`
  fragment DocCoverMarkerFields on Marker {
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
`)

export const DocCoverItemFields = graphql(`
  fragment DocCoverItemFields on DocCoverCardItem {
    id
    nodeId
    docId
    index
    type
    title
    href
    badge
    leafCount
    marker {
      ...DocCoverMarkerFields
    }
  }
`)
