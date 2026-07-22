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
  fragment docCoverItemFields on DocCoverItem {
    id
    nodeId
    docId
    index
    uiConfig
    type
    title
    href
    badge
    digest
    marker {
      ...docCoverMarkerFields
    }
  }
`

const docCover = gql`
  query ($community: String!, $view: DocCoverView = PUBLIC) {
    docCover(community: $community, view: $view) {
      groups {
        id
        groupId
        index
        uiConfig
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
