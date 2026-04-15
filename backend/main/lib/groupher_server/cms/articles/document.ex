defmodule GroupherServer.CMS.Articles.Document do
  @moduledoc """
  CRUD operations for article documents.
  """
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.FrontDesk
  alias CMS.Model.ArticleDocument
  alias Helper.{ContentPayload, ContentPipeline, Multi, ORM, T}

  @type document_result :: {:ok, map()} | {:error, map()}

  @spec create(map(), map()) :: document_result()
  def create(article, %{readme: readme} = attrs) do
    with {:ok, payload} <- ContentPipeline.from_readme(readme) do
      attrs = attrs |> Map.drop([:readme]) |> Map.put(:content_payload, payload)
      create(article, attrs)
    end
  end

  @spec create(map(), map()) :: document_result()
  def create(article, %{content_payload: payload}) do
    with {:ok, article_thread} <- FrontDesk.thread_of(article),
         false <- article_document_exist(article) do
      attrs = ContentPayload.pick_valid_fields(payload)

      Multi.new()
      |> Multi.run(:create_article_document, fn _, _ ->
        document_attrs =
          Map.merge(attrs, %{
            thread: article_thread,
            article_id: article.id,
            title: article.title
          })

        ArticleDocument |> ORM.create(document_attrs)
      end)
      |> Multi.run(:create_thread_document, fn _, _ ->
        attrs = attrs |> Map.put(:"#{article_thread}_id", article.id)

        CMS.Model
        |> Module.concat("#{Recase.to_title(to_string(article_thread))}Document")
        |> ORM.create(attrs)
      end)
      |> Repo.transaction()
      |> result()
    else
      true ->
        {:error, {:already_exist, "document already exist"}}
    end
  end

  def create(article, %{body: body}) when is_binary(body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      create(article, %{content_payload: payload})
    end
  end

  defp article_document_exist(article) do
    with {:ok, article_thread} <- FrontDesk.thread_of(article) do
      {:ok, count} =
        ArticleDocument
        |> where([ad], ad.thread == ^article_thread and ad.article_id == ^article.id)
        |> ORM.count()

      count > 0
    end
  end

  @doc """
  update both article and thread document
  """
  @spec update(map(), map()) :: document_result()
  def update(article, %{content_payload: payload}) do
    with {:ok, article_thread} <- FrontDesk.thread_of(article),
         {:ok, article_doc} <- find_article_document(article_thread, article),
         {:ok, thread_doc} <- find_thread_document(article_thread, article) do
      attrs = ContentPayload.pick_valid_fields(payload)

      Multi.new()
      |> Multi.run(:update_article_document, fn _, _ ->
        article_doc
        |> ORM.update(Map.merge(attrs, %{title: article.title}))
      end)
      |> Multi.run(:update_thread_document, fn _, _ ->
        thread_doc |> ORM.update(attrs)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def update(article, %{body: body}) when is_binary(body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      __MODULE__.update(article, %{content_payload: payload})
    end
  end

  def update(article, %{title: _title} = attrs) do
    with {:ok, article_thread} <- FrontDesk.thread_of(article),
         {:ok, article_doc} <- find_article_document(article_thread, article) do
      article_doc |> ORM.update(%{title: attrs.title})
    end
  end

  def update(article, _), do: {:ok, article}

  defp find_article_document(article_thread, article) do
    ORM.find_by(ArticleDocument, %{article_id: article.id, thread: article_thread})
  end

  defp find_thread_document(article_thread, article) do
    CMS.Model
    |> Module.concat("#{Recase.to_title(to_string(article_thread))}Document")
    |> ORM.find_by(%{:"#{article_thread}_id" => article.id})
  end

  @doc """
  remove article document forever
  """
  @spec remove(atom(), T.id()) :: {:ok, ArticleDocument.t()} | {:error, map()}
  def remove(thread, id) do
    ArticleDocument |> ORM.findby_delete!(%{thread: thread, article_id: id})
  end

  defp result({:ok, %{create_thread_document: result}}), do: {:ok, result}
  defp result({:ok, %{update_article_document: result}}), do: {:ok, result}

  defp result({:error, _, _result, _steps}) do
    {:error, {:create_fails, "create document"}}
  end
end
