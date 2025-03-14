defmodule GroupherServer.Test.Helper.Schema do
  @moduledoc false

  def m(:create_post), do: create_article(:post)
  def m(:create_changelog), do: create_article(:changelog)
  def m(:create_blog), do: create_article(:blog)
  def m(:create_doc), do: create_article(:doc)

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
