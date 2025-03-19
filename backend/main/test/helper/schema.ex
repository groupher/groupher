defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def m(:create_post), do: create_article(:post)
  def m(:create_changelog), do: create_article(:changelog)
  def m(:create_blog), do: create_article(:blog)
  def m(:create_doc), do: create_article(:doc)

  def m(:mirror_article) do
    """
    mutation($id: ID!, $thread: Thread, $community: String!, $targetCommunity: String!, $articleTags: [ID]) {
        mirrorArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity, articleTags: $articleTags) {
          id
        }
      }
    """
  end

  def m(:unmirror_article) do
    """
    mutation($id: ID!, $thread: Thread, $community: String!, $targetCommunity: String!) {
      unmirrorArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity) {
        id
      }
    }
    """
  end

  def m(:mirror_to_home) do
    """
    mutation($id: ID!, $community: String!, $thread: Thread, $articleTags: [ID]) {
      mirrorToHome(id: $id, community: $community, thread: $thread, articleTags: $articleTags) {
        id
      }
    }
    """
  end

  def m(:move_article) do
    """
    mutation($community: String!, $thread: Thread, $targetCommunity: String!, $id: ID!, $articleTags: [ID]) {
      moveArticle(id: $id, thread: $thread, community: $community, targetCommunity: $targetCommunity, articleTags: $articleTags) {
        id
      }
    }
    """
  end

  def m(:move_to_blackhole) do
    """
    mutation($community: String!, $thread: Thread, $id: ID!, $articleTags: [ID]) {
      moveToBlackhole(community: $community, thread: $thread, id: $id, articleTags: $articleTags) {
        id
      }
    }
    """
  end

  defp create_article(thread) do
    thread = thread |> Atom.to_string() |> String.capitalize()

    """
    mutation(
      $title: String!
      $body: String!
      $community: String!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      create#{thread}(
        title: $title
        body: $body
        community: $community
        articleTags: $articleTags
        linkAddr: $linkAddr
      ) {
        id
        title
        linkAddr
        document {
          bodyHtml
        }
        originalCommunity {
          id
        }
      }
    }
    """
  end
end
