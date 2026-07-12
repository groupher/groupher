defmodule GroupherServer.CMS.Articles.Document do
  @moduledoc """
  CRUD operations for article documents.
  """
  import Ecto.Query, warn: false

  alias GroupherServer.CMS

  alias CMS.FrontDesk
  alias CMS.Model.{ArticleDocument, Doc}
  alias Helper.{ArticlePayload, ContentPipeline, ORM, T}

  @type document_result :: {:ok, map()} | {:error, map()}

  @doc "Creates the derived ArticleDocument from README, body, or parsed content input."
  @spec create(map(), map()) :: document_result()
  def create(article, %{readme: readme} = attrs) do
    with {:ok, payload} <- ContentPipeline.from_readme(readme) do
      attrs = attrs |> Map.drop([:readme]) |> Map.put(:article_payload, payload)
      create(article, attrs)
    end
  end

  def create(article, %{body: body}) when is_binary(body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      create(article, %{article_payload: payload})
    end
  end

  def create(article, %{article_payload: payload}) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         false <- article_document_exists?(article) do
      attrs = ArticlePayload.pick_valid_fields(payload)

      ArticleDocument
      |> ORM.create(
        Map.merge(attrs, %{
          thread: thread,
          article_id: article.id,
          title: article.title
        })
      )
    else
      true -> document_already_exists_error()
      {:error, _} = error -> error
    end
  end

  @doc """
  Creates doc documents for a `Doc` struct.

  `Doc` is always thread `:doc`, so we bypass `FrontDesk.thread_of`. Callers
  that already know the thread should prefer this entry point.
  """
  @spec create_doc(Doc.t(), map()) :: document_result()
  def create_doc(%Doc{} = article, attrs) do
    with {:ok, payload} <- maybe_parse_payload(attrs),
         false <- article_document_exists?(article) do
      pick = ArticlePayload.pick_valid_fields(payload)

      ArticleDocument
      |> ORM.create(
        Map.merge(pick, %{thread: :doc, article_id: article.id, title: article.title})
      )
    else
      true -> document_already_exists_error()
      {:error, _} = error -> error
    end
  end

  @doc """
  Updates doc documents for a `Doc` struct.
  """
  @spec update_doc(Doc.t(), map()) :: document_result()
  def update_doc(%Doc{} = article, attrs) do
    with {:ok, payload} <- maybe_parse_payload(attrs),
         {:ok, article_doc} <- find_article_document(:doc, article) do
      pick = ArticlePayload.pick_valid_fields(payload)

      article_doc
      |> ORM.update(Map.merge(pick, %{title: Map.get(attrs, :title, article_doc.title)}))
    end
  end

  defp maybe_parse_payload(%{article_payload: payload}), do: {:ok, payload}

  defp maybe_parse_payload(%{body: body}) when is_binary(body),
    do: ContentPipeline.parse(%{body: body})

  defp maybe_parse_payload(_), do: {:error, {:custom, "payload is required"}}

  defp document_already_exists_error, do: {:error, {:custom, "document already exists"}}

  defp article_document_exists?(%Doc{} = article) do
    {:ok, count} =
      ArticleDocument
      |> where([ad], ad.thread == :doc and ad.article_id == ^article.id)
      |> ORM.count()

    count > 0
  end

  defp article_document_exists?(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      {:ok, count} =
        ArticleDocument
        |> where([ad], ad.thread == ^thread and ad.article_id == ^article.id)
        |> ORM.count()

      count > 0
    end
  end

  @doc """
  update article document
  """
  @spec update(map(), map()) :: document_result()
  def update(article, %{article_payload: payload}) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, article_doc} <- find_article_document(thread, article) do
      attrs = ArticlePayload.pick_valid_fields(payload)

      article_doc
      |> ORM.update(Map.merge(attrs, %{title: article.title}))
    end
  end

  def update(article, %{body: body}) when is_binary(body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      __MODULE__.update(article, %{article_payload: payload})
    end
  end

  def update(article, %{title: _title} = attrs) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, article_doc} <- find_article_document(thread, article) do
      article_doc |> ORM.update(%{title: attrs.title})
    end
  end

  def update(article, _), do: {:ok, article}

  defp find_article_document(thread, article) do
    ORM.find_by(ArticleDocument, %{article_id: article.id, thread: thread})
  end

  @doc """
  remove article document forever
  """
  @spec remove(atom(), T.id()) :: {:ok, ArticleDocument.t()} | {:error, map()}
  def remove(thread, id) do
    ArticleDocument |> ORM.findby_delete!(%{thread: thread, article_id: id})
  end
end
