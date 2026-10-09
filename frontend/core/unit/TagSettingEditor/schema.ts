import { graphql } from '~/graphql/authoring'

const deleteCommunityTag = graphql(`
  mutation DeleteCommunityTag($commandId: ID!, $id: ID!, $community: String!, $thread: Thread) {
    deleteCommunityTag(commandId: $commandId, id: $id, community: $community, thread: $thread) {
      id
    }
  }
`)
const createCommunityTag = graphql(`
  mutation CreateCommunityTag(
    $commandId: ID!
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
      commandId: $commandId
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
`)
const updateCommunityTag = graphql(`
  mutation UpdateCommunityTag(
    $commandId: ID!
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
      commandId: $commandId
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
`)

const schema = {
  deleteCommunityTag,
  createCommunityTag,
  updateCommunityTag,
}

export default schema
