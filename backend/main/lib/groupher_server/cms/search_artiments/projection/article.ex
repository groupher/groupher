defmodule GroupherServer.CMS.SearchArtiments.Projection.Article do
  @moduledoc """
  Projects one public Article and its ArticleDocument into a Search Artiment.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Article
        -> search platform
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat
  alias CMS.SearchArtiments.Artiment
  alias Helper.Constant

  require CMS.Const

  @legal Constant.CMS.pending(:legal)

  @doc """
  Projects one public article into a Search Artiment.

  Reloads the article with community, document, and author data before building
  the canonical projection with live interaction counts. Non-public articles
  return an `ErrorCat.Error` with reason `:not_searchable`; incomplete articles return an
  invalid projection error.

  ## Examples

      CMS.SearchArtiments.Projection.Article.project(:post, article)

  """
  @spec project(Artiment.thread(), struct()) :: {:ok, Artiment.t()} | {:error, term()}
  def project(thread, article) do
    article = Repo.preload(article, [:community, :document, author: :user])

    with :ok <- searchable?(article),
         %{slug: community_ref} <- article.community,
         %{plain_text: plain_text, body_hash: body_hash} = document <- article.document,
         true <- is_binary(plain_text) and is_binary(body_hash),
         true <- is_binary(article.article_hash_id),
         true <- not is_nil(article.inner_id) do
      ref = Artiment.article_ref(thread, article.article_hash_id)
      counts = CMS.Interactions.counts([article]) |> Map.get({thread, article.id}, %{})

      {:ok,
       %Artiment{
         ref: ref,
         type: :article,
         community_ref: community_ref,
         thread: thread,
         article_ref: ref,
         title: article.title,
         plain_text: plain_text,
         digest: article.digest || document.digest,
         locator: %{
           community: community_ref,
           thread: thread,
           inner_id: to_string(article.inner_id)
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

  defp searchable?(article) do
    if article.stage == CMS.Const.stage(:public) and article.pending == @legal do
      :ok
    else
      {:error, ErrorCat.not_searchable("Article is not publicly searchable")}
    end
  end

  defp author_ref(%{author: %{user: %{login: login}}}) when is_binary(login), do: login
  defp author_ref(_article), do: nil
end
