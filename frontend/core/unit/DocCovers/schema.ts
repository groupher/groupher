import { gql } from 'urql'

const markerFields = gql`
  fragment docCoverMarkerFields on Marker {
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

const coverItemFields = gql`
  fragment docCoverItemFields on DocCoverCardItem {
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
      ...docCoverMarkerFields
    }
  }
`

const docCover = gql`
  query ($community: String!, $view: DocCoverView = PUBLIC) {
    docCover(community: $community, view: $view) {
      cards {
        id
        groupNodeId
        index
        appearance
        title
        items {
          ...docCoverItemFields
        }
      }
      pinnedDocs {
        nodeId
        index
        appearance
        href
        doc {
          title
          author {
            avatar
            nickname
          }
          document {
            thumbnail
          }
        }
      }
    }
  }
  ${markerFields}
  ${coverItemFields}
`

const schema = {
  docCover,
}

export default schema
