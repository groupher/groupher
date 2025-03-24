defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def m(:create_article, thread) do
    """
    mutation(
      $title: String!
      $body: String!
      $community: String!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      create#{t(thread)}(
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

  def m(:sink_article, thread) do
    """
    mutation($id: ID!, $community: String!){
      sink#{t(thread)}(id: $id, community: $community) {
        id
      }
    }
    """
  end

  def m(:undo_sink_article, thread) do
    """
    mutation($id: ID!, $community: String!){
      undoSink#{t(thread)}(id: $id, community: $community) {
        id
      }
    }
    """
  end

  def m(:lock_comment, thread) do
    """
    mutation($id: ID!, $community: String!) {
      lock#{t(thread)}Comment(id: $id, community: $community) {
        id
        title
      }
    }
    """
  end

  def m(:unlock_comment, thread) do
    thread = thread |> Atom.to_string() |> String.capitalize()

    """
    mutation($id: ID!, $community: String!){
      undoLock#{thread}Comment(id: $id, community: $community) {
        id
      }
    }
    """
  end

  def m(:set_article_tag) do
    """
    mutation($id: ID!, $thread: Thread, $articleTagId: ID!, $community: String!) {
      setArticleTag(id: $id, thread: $thread, articleTagId: $articleTagId, community: $community) {
        id
      }
    }
    """
  end

  def m(:unset_article_tag) do
    """
    mutation($id: ID!, $thread: Thread, $articleTagId: ID!, $community: String!) {
      unsetArticleTag(id: $id, thread: $thread, articleTagId: $articleTagId, community: $community) {
        id
        title
      }
    }
    """
  end

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

  defp t(thread), do: thread |> Atom.to_string() |> String.capitalize()
end
