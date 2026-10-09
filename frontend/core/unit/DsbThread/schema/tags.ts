import { graphql } from '~/graphql/authoring'

export const communityTagGroups = graphql(`
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
  mutation DashboardUpdateCommunityTag(
    $commandId: ID!
    $id: ID!
    $color: RainbowColor
    $title: String
    $slug: String
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

export const createCommunityTagGroup = graphql(`
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
  createCommunityTagGroup,
  updateCommunityTagGroup,
  createCommunityTag,
  reindexTagsInGroup,
  reindexCommunityTags,
  reindexCommunityTagGroups,
}
