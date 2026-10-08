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
    with %{slug: community_ref} <- article.community,
         %{plain_text: plain_text, body_hash: body_hash} = document <- article.document,
         true <- is_binary(plain_text) and is_binary(body_hash),
         true <- is_binary(article.id),
         true <- is_binary(article.revision_id),
         inner_id when not is_nil(inner_id) <- Map.get(article, :inner_id) do
      ref = Artiment.article_key(thread, article.id, community_ref)
      counts = CMS.Interactions.counts([article]) |> Map.get({thread, article.id}, %{})

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
         digest: article.digest || document.digest,
         locator: %{
           community: community_ref,
           thread: thread,
           inner_id: to_string(inner_id)
         },
         author_ref: author_ref(article),
         locale: article.community.locale,
         upvotes_count: Map.get(counts, :upvotes_count, 0) || 0,
         comments_count: article.comments_count || 0,
         published_at: article.active_at,
         inserted_at: article.inserted_at,
         updated_at: article.updated_at,
         content_hash: body_hash,
         schema_version: document.schema_version || article.schema_version || 1
       }}
    else
      {:error, _} = error -> error
      _ -> {:error, ErrorCat.invalid_search_artiment("Article projection is incomplete")}
    end
  end

  defp author_ref(%{author: %{login: login}}) when is_binary(login), do: login
  defp author_ref(_article), do: nil
end
