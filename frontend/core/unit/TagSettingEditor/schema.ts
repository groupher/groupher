import { gql } from 'urql'

const deleteCommunityTag = gql`
  mutation ($id: ID!, $community: String!, $thread: Thread) {
    deleteCommunityTag(id: $id, community: $community, thread: $thread) {
      id
    }
  }
`
const createCommunityTag = gql`
  mutation (
    $thread: Thread!
    $title: String!
    $slug: String!
    $layout: String
    $color: RainbowColor!
    $group: String
    $community: String!
  ) {
    createCommunityTag(
      thread: $thread
      title: $title
      slug: $slug
      layout: $layout
      color: $color
      group: $group
      community: $community
    ) {
      id
    }
  }
`
const updateCommunityTag = gql`
  mutation (
    $id: ID!
    $color: RainbowColor
    $title: String
    $layout: String
    $desc: String
    $slug: String
    $community: String!
    $group: String
  ) {
    updateCommunityTag(
      id: $id
      color: $color
      title: $title
      desc: $desc
      layout: $layout
      slug: $slug
      community: $community
      group: $group
    ) {
      id
    }
  }
`

const schema = {
  deleteCommunityTag,
  createCommunityTag,
  updateCommunityTag,
}

export default schema
