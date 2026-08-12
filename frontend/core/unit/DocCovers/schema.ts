import { graphql } from '~/graphql/authoring'

const docCover = graphql(`
  query DocCover($community: String!, $view: DocCoverView = PUBLIC) {
    docCover(community: $community, view: $view) {
      cards {
        id
        groupNodeId
        index
        appearance
        title
        items {
          ...DocCoverItemFields
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
`)

const schema = {
  docCover,
}

export default schema
