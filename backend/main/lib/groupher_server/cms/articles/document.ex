defmodule GroupherServer.CMS.Articles.Document do
  @moduledoc """
  CRUD operations for article documents.
  """
  import Ecto.Query, warn: false

  alias GroupherServer.CMS

  alias CMS.Artiment.BodyBag
  alias CMS.FrontDesk
  alias CMS.Model.{ArticleDocument, Doc}
  alias Helper.{ORM, T}

  @type document_result :: {:ok, map()} | {:error, map()}

  @doc "Creates an ArticleDocument from a publisher-produced BodyBag."
  @spec create(map(), map()) :: document_result()
  def create(article, %{body_bag: body_bag}) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, body_bag} <- BodyBag.cast(body_bag, thread: thread),
         false <- article_document_exists?(article) do
      create_document(article, thread, BodyBag.to_document_attrs(body_bag))
    else
      true -> document_already_exists_error()
      {:error, _} = error -> error
    end
  end

  def create(_article, _attrs), do: body_bag_required_error()

  @doc """
  Creates doc documents for a `Doc` struct.

  `Doc` is always thread `:doc`, so we bypass `FrontDesk.thread_of`. Callers
  that already know the thread should prefer this entry point.
  """
  @spec create_doc(Doc.t(), map()) :: document_result()
  def create_doc(%Doc{} = article, %{body_bag: body_bag}) do
    with {:ok, body_bag} <- BodyBag.cast(body_bag, thread: :doc),
         false <- article_document_exists?(article) do
      create_document(article, :doc, BodyBag.to_document_attrs(body_bag))
    else
      true -> document_already_exists_error()
      {:error, _} = error -> error
    end
  end

  def create_doc(%Doc{}, _attrs), do: body_bag_required_error()

  @doc """
  Updates doc documents for a `Doc` struct.
  """
  @spec update_doc(Doc.t(), map()) :: document_result()
  def update_doc(%Doc{} = article, %{body_bag: body_bag} = attrs) do
    with {:ok, body_bag} <- BodyBag.cast(body_bag, thread: :doc),
         {:ok, article_doc} <- find_article_document(:doc, article) do
      body_bag
      |> BodyBag.to_document_attrs()
      |> Map.put(:title, Map.get(attrs, :title, article_doc.title))
      |> then(&ORM.update(article_doc, &1))
    end
  end

  def update_doc(%Doc{} = article, %{title: title}) when is_binary(title) do
    with {:ok, article_doc} <- find_article_document(:doc, article) do
      ORM.update(article_doc, %{title: title})
    end
  end

  def update_doc(%Doc{}, _attrs), do: body_bag_required_error()

  defp document_already_exists_error, do: {:error, {:custom, "document already exists"}}
  defp body_bag_required_error, do: {:error, {:custom, "Article BodyBag is required"}}

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
  def update(article, %{body_bag: body_bag}) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, body_bag} <- BodyBag.cast(body_bag, thread: thread),
         {:ok, article_doc} <- find_article_document(thread, article) do
      body_bag
      |> BodyBag.to_document_attrs()
      |> Map.put(:title, article.title)
      |> then(&ORM.update(article_doc, &1))
    end
  end

  def update(article, %{title: _title} = attrs) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, article_doc} <- find_article_document(thread, article) do
      article_doc |> ORM.update(%{title: attrs.title})
    end
  end

  def update(article, _), do: {:ok, article}

  defp create_document(article, thread, attrs) do
    ArticleDocument
    |> ORM.create(
      Map.merge(attrs, %{
        thread: thread,
        article_id: article.id,
        title: article.title
      })
    )
  end

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
