defmodule GroupherServer.CMS.ArtimentMentions.PublicUrl do
  @moduledoc """
  Builds platform relative paths from current public binding coordinates.

      Community binding + public inner ID -> Article path -> Comment fragment
  """

  @doc "Returns the current platform path for an Article, Ticket or Doc."
  def article(%{community_slug: community, thread: thread, inner_id: inner_id} = target)
      when is_binary(community) and is_atom(thread) and is_integer(inner_id) and inner_id > 0 do
    base = "/#{community}/#{thread}/#{inner_id}"

    case thread do
      :doc -> base <> "/" <> doc_slug(Map.get(target, :slug))
      _ -> base
    end
  end

  def article(_), do: nil

  @doc "Returns a Comment deep link using its public inner ID."
  def comment(article_target, comment_inner_id)
      when is_integer(comment_inner_id) and comment_inner_id > 0 do
    case article(article_target) do
      nil -> nil
      path -> path <> "#comment-#{comment_inner_id}"
    end
  end

  def comment(_, _), do: nil

  defp doc_slug(slug) when is_binary(slug) and slug != "", do: URI.encode(slug)
  defp doc_slug(_), do: "doc"
end
