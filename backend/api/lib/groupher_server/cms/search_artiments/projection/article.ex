defmodule GroupherServer.CMS.SearchArtiments.Projection.Article do
  @moduledoc """
  Projects one stable public Article DTO into a Search Artiment.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Article
        -> search platform
  """

  alias GroupherServer.CMS
  alias CMS.ErrorCat

  alias CMS.SearchArtiments.Artiment

  @doc """
  Projects one public article into a Search Artiment.

  The caller must supply the actor-scoped public DTO returned by FrontDesk.

  ## Examples

      CMS.SearchArtiments.Projection.Article.project(:post, article)

  """
  @spec project(Artiment.thread(), struct()) :: {:ok, Artiment.t()} | {:error, term()}
  def project(thread, article) do
    project_with_counts(thread, article, fn ->
      CMS.ArticleStats.search_counts(thread, article.id)
    end)
  end

  @doc "Projects using previously batched search counts."
  def project(thread, article, counts_by_id) when is_map(counts_by_id) do
    project_with_counts(thread, article, fn ->
      case Map.fetch(counts_by_id, article.id) do
        {:ok, counts} -> {:ok, counts}
        :error -> CMS.ArticleStats.search_counts(thread, article.id)
      end
    end)
  end

  defp project_with_counts(thread, article, get_counts) do
    with %{slug: community_ref} <- article.community,
         %{plain_text: plain_text, body_hash: body_hash} = body <- article.body,
         true <- is_binary(plain_text) and is_binary(body_hash),
         true <- is_binary(article.id),
         true <- is_binary(article.revision_id),
         inner_id when not is_nil(inner_id) <- Map.get(article, :inner_id),
         {:ok, counts} <- get_counts.() do
      ref = Artiment.article_key(thread, article.id, community_ref)

      {:ok,
       %Artiment{
         ref: ref,
         type: :article,
         community_ref: community_ref,
         thread: thread,
         article_id: article.id,
         indexed_revision_id: article.revision_id,
         title: article.title,
         plain_text: plain_text,
         digest: article.digest || body.digest,
         locator: %{
           community: community_ref,
           thread: thread,
           inner_id: to_string(inner_id)
         },
         author_ref: author_ref(article),
         locale: article.community.locale,
         upvotes_count: counts.upvotes_count,
         comments_count: counts.comments_count,
         published_at: article.active_at,
         inserted_at: article.inserted_at,
         updated_at: article.updated_at,
         content_hash: body_hash,
         schema_version: body.schema_version || article.schema_version || 1
       }}
    else
      {:error, _} = error -> error
      _ -> {:error, ErrorCat.invalid_search_artiment("Article projection is incomplete")}
    end
  end

  defp author_ref(%{author: %{login: login}}) when is_binary(login), do: login
  defp author_ref(_article), do: nil
end
