defmodule GroupherServer.CMS.Articles.ArticleTransportResult do
  @moduledoc """
  Adds stable transport compatibility fields to a revision-rooted Article read.

      RevisionResult.build/1
        -> ArticleTransportResult.decorate/3
        -> GraphQL/domain response

  This adapter is not allowed to replace the revision-rooted content with the
  current ArticlePublic head.
  """

  @doc "Decorates a revision-rooted projection without changing its content anchor."
  @spec decorate(map(), map(), term()) :: map()
  def decorate(result, context, viewer_context \\ nil)

  def decorate(
        result,
        %{
          article: article,
          revision: revision,
          community: community,
          confirmation: confirmation
        },
        _viewer_context
      ) do
    result
    |> Map.merge(%{
      article: article,
      revision: revision,
      community: community,
      # active_at belongs to the current operational Article state, not to the
      # immutable revision snapshot.  Keep it out of RevisionResult.build/1.
      active_at: Map.get(article, :active_at),
      public: %{
        revision_id: revision.id,
        publication_version: Map.get(confirmation, :publication_version),
        published_at: Map.get(confirmation, :published_at),
        title: revision.title,
        digest: revision.digest,
        slug: revision.slug,
        body_hash: revision.content_hash
      }
    })
    |> maybe_put(:command_id, Map.get(confirmation, :command_id))
    |> maybe_put(:first_publish?, Map.get(confirmation, :first_publish?))
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
