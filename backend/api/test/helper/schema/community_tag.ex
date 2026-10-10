defmodule GroupherServer.Test.Helper.Schema.CommunityTag do
  @moduledoc "GraphQL documents used by community tag tests."

  def m(:reindex_tags_in_group) do
    """
    mutation($community: String!, $thread: Thread, $groupId: ID!, $tags: [ReindexTagInput], $commandId: ID!) {
          reindexTagsInGroup(community: $community, thread: $thread, groupId: $groupId, tags: $tags, commandId: $commandId) {
            done
          }
        }
    """
  end

  def m(:reindex_community_tags) do
    """
    mutation($community: String!, $thread: Thread, $tags: [ReindexCommunityTagInput], $commandId: ID!) {
          reindexCommunityTags(community: $community, thread: $thread, tags: $tags, commandId: $commandId) {
            done
          }
        }
    """
  end

  def m(:create_community_tag) do
    """
    mutation($thread: Thread!, $title: String!, $slug: String!, $color: RainbowColor!, $groupId: ID!, $community: String!, $extra: [String], $commandId: ID!) {
          createCommunityTag(thread: $thread, title: $title, slug: $slug, color: $color, groupId: $groupId, community: $community, extra: $extra, commandId: $commandId) {
            id
            title
            color
            thread
            group
            groupId
            extra
            community {
              slug
              logo
              title
            }
          }
        }
    """
  end

  def m(:update_community_tag) do
    """
    mutation($id: ID!, $color: RainbowColor, $title: String, $slug: String, $community: String!, $thread: Thread, $extra: [String], $marker: MarkerInput, $commandId: ID!) {
          updateCommunityTag(id: $id, color: $color, title: $title, slug: $slug, community: $community, thread: $thread, extra: $extra, marker: $marker, commandId: $commandId) {
            id
            title
            color
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
    """
  end

  def m(:delete_community_tag) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread, $commandId: ID!){
          deleteCommunityTag(id: $id, community: $community, thread: $thread, commandId: $commandId) {
            id
          }
        }
    """
  end

  def m(:update_community_tag_2) do
    """
    mutation($id: ID!, $color: RainbowColor, $title: String, $desc: String, $slug: String, $community: String!, $extra: [String], $marker: MarkerInput, $groupId: ID, $commandId: ID!) {
          updateCommunityTag(id: $id, color: $color, title: $title, desc: $desc, slug: $slug, community: $community, extra: $extra, marker: $marker, groupId: $groupId, commandId: $commandId) {
            id
            title
            desc
            color
            group
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
    """
  end

  def m(:delete_community_tag_2) do
    """
    mutation($id: ID!, $community: String!, $commandId: ID!){
          deleteCommunityTag(id: $id, community: $community, commandId: $commandId) {
            id
          }
        }
    """
  end

  def m(:update_community_tag_group) do
    """
    mutation($id: ID!, $community: String!, $title: String!, $thread: Thread, $commandId: ID!) {
          updateCommunityTagGroup(id: $id, community: $community, title: $title, thread: $thread, commandId: $commandId) {
            id
          }
        }
    """
  end

  def m(:delete_community_tag_group) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread, $commandId: ID!) {
          deleteCommunityTagGroup(id: $id, community: $community, thread: $thread, commandId: $commandId) {
            id
          }
        }
    """
  end
end
