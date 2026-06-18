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
    $groupId: ID!
    $community: String!
    $marker: MarkerInput
  ) {
    createCommunityTag(
      thread: $thread
      title: $title
      slug: $slug
      layout: $layout
      color: $color
      groupId: $groupId
      community: $community
      marker: $marker
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
    $groupId: ID
    $marker: MarkerInput
  ) {
    updateCommunityTag(
      id: $id
      color: $color
      title: $title
      desc: $desc
      layout: $layout
      slug: $slug
      community: $community
      groupId: $groupId
      marker: $marker
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
