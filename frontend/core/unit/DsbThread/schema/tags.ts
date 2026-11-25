import { graphql } from '~/graphql/authoring'

export const communityTagGroups = graphql(`
  "Get community tag groups"
  query DashboardCommunityTagGroups($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ...DashboardTagFields
      }
    }
  }
`)

export const updateCommunityTag = graphql(`
  "Update a tag"
  mutation DashboardUpdateCommunityTag(
    $commandId: ID!
    $id: ID!
    $color: RainbowColor
    $title: String
    $slug: String
    $layout: String
    $desc: String
    $community: String!
    $extra: [String]
    $marker: MarkerInput
    $groupId: ID
  ) {
    updateCommunityTag(
      commandId: $commandId
      id: $id
      color: $color
      title: $title
      slug: $slug
      layout: $layout
      desc: $desc
      community: $community
      extra: $extra
      marker: $marker
      groupId: $groupId
    ) {
      id
      title
      slug
      color
      groupId
      extra
      marker {
        type
        provider
        name
        src
        unified
      }
    }
  }
`)

export const deleteCommunityTag = graphql(`
  "Delete a tag by thread"
  mutation DashboardDeleteCommunityTag(
    $commandId: ID!
    $id: ID!
    $community: String!
    $thread: Thread
  ) {
    deleteCommunityTag(commandId: $commandId, id: $id, community: $community, thread: $thread) {
      id
    }
  }
`)

export const createCommunityTagGroup = graphql(`
  "Create a tag group"
  mutation DashboardCreateCommunityTagGroup(
    $commandId: ID!
    $thread: Thread!
    $title: String!
    $community: String!
  ) {
    createCommunityTagGroup(
      commandId: $commandId
      thread: $thread
      title: $title
      community: $community
    ) {
      id
      title
      index
      tags {
        ...DashboardTagFields
      }
    }
  }
`)

export const updateCommunityTagGroup = graphql(`
  "Update a tag group"
  mutation DashboardUpdateCommunityTagGroup(
    $commandId: ID!
    $id: ID!
    $title: String!
    $community: String!
    $thread: Thread
  ) {
    updateCommunityTagGroup(
      commandId: $commandId
      id: $id
      title: $title
      community: $community
      thread: $thread
    ) {
      id
      title
      index
      tags {
        ...DashboardTagFields
      }
    }
  }
`)

export const createCommunityTag = graphql(`
  "Create a tag"
  mutation DashboardCreateCommunityTag(
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

export const reindexTagsInGroup = graphql(`
  "Reindex tags in given group"
  mutation DashboardReindexTagsInGroup(
    $commandId: ID!
    $community: String!
    $thread: Thread
    $groupId: ID!
    $tags: [ReindexTagInput]
  ) {
    reindexTagsInGroup(
      commandId: $commandId
      community: $community
      thread: $thread
      groupId: $groupId
      tags: $tags
    ) {
      done
    }
  }
`)

export const reindexCommunityTags = graphql(`
  "Reindex tags across groups"
  mutation DashboardReindexCommunityTags(
    $commandId: ID!
    $community: String!
    $thread: Thread
    $tags: [ReindexCommunityTagInput]
  ) {
    reindexCommunityTags(
      commandId: $commandId
      community: $community
      thread: $thread
      tags: $tags
    ) {
      done
    }
  }
`)

export const reindexCommunityTagGroups = graphql(`
  "Reindex tag groups"
  mutation DashboardReindexCommunityTagGroups(
    $commandId: ID!
    $community: String!
    $thread: Thread
    $groups: [ReindexCommunityTagGroupInput]
  ) {
    reindexCommunityTagGroups(
      commandId: $commandId
      community: $community
      thread: $thread
      groups: $groups
    ) {
      done
    }
  }
`)

export default {
  communityTagGroups,
  updateCommunityTag,
  deleteCommunityTag,
  createCommunityTagGroup,
  updateCommunityTagGroup,
  createCommunityTag,
  reindexTagsInGroup,
  reindexCommunityTags,
  reindexCommunityTagGroups,
}
