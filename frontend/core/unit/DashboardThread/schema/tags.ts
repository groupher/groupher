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
    $thread: Thread!
    $title: String!
    $community: String!
  ) {
    createCommunityTagGroup(thread: $thread, title: $title, community: $community) {
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
    $id: ID!
    $title: String!
    $community: String!
    $thread: Thread
  ) {
    updateCommunityTagGroup(id: $id, title: $title, community: $community, thread: $thread) {
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
`)

export const reindexTagsInGroup = graphql(`
  mutation DashboardReindexTagsInGroup(
    $community: String!
    $thread: Thread
    $groupId: ID!
    $tags: [ReindexTagInput]
  ) {
    reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags) {
      done
    }
  }
`)

export const reindexCommunityTags = graphql(`
  mutation DashboardReindexCommunityTags(
    $community: String!
    $thread: Thread
    $tags: [ReindexCommunityTagInput]
  ) {
    reindexCommunityTags(community: $community, thread: $thread, tags: $tags) {
      done
    }
  }
`)

export const reindexCommunityTagGroups = graphql(`
  mutation DashboardReindexCommunityTagGroups(
    $community: String!
    $thread: Thread
    $groups: [ReindexCommunityTagGroupInput]
  ) {
    reindexCommunityTagGroups(community: $community, thread: $thread, groups: $groups) {
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
