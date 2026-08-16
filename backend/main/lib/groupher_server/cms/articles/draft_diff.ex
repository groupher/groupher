defmodule GroupherServer.CMS.Articles.DraftDiff do
  @moduledoc """
  Computes the transient difference between one current Draft and Public head.

  This is the only Article-level source for has_unpublished_changes. It never
  creates a revision or Snapshot row.
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Draft
  alias CMS.Model.{ArticleDocument, Community}

  def compare(%{stage: :draft} = draft, %{stage: :public} = public) do
    document_changed? =
      with {:ok, draft_document} <- document(draft),
           {:ok, public_document} <- document(public) do
        cond do
          draft_document.body_hash != public_document.body_hash -> true
          not is_nil(draft_document.body_hash) -> false
          true -> draft_document.json != public_document.json
        end
      else
        _ -> true
      end

    fields =
      draft.__struct__.version_fields()
      |> Enum.reduce(%{}, fn field, acc ->
        before = Map.get(public, field)
        after_value = Map.get(draft, field)

        if before == after_value,
          do: acc,
          else: Map.put(acc, field, %{before: before, after: after_value})
      end)

    %{
      changed: map_size(fields) > 0 or document_changed?,
      document_changed: document_changed?,
      fields: fields
    }
  end

  def compare(_draft, _public), do: %{changed: false, document_changed: false, fields: %{}}

  def has_unpublished_changes(%Community{} = community, thread, article_hash_id, opts \\ []) do
    with {:ok, draft} <- Draft.read(community, thread, article_hash_id, opts),
         {:ok, public} <- Draft.read_public(community, thread, article_hash_id, opts) do
      {:ok, compare(draft, public).changed}
    else
      {:error, {:not_exist, _}} ->
        case Draft.read(community, thread, article_hash_id, opts) do
          {:ok, _draft} -> {:ok, true}
          _ -> {:ok, false}
        end

      error ->
        error
    end
  end

  def compare_current(%Community{} = community, thread, article_hash_id, opts \\ []) do
    case Draft.read(community, thread, article_hash_id, opts) do
      {:ok, draft} ->
        case Draft.read_public(community, thread, article_hash_id, opts) do
          {:ok, public} ->
            {:ok, compare(draft, public)}

          {:error, {:not_exist, _}} ->
            {:ok, %{changed: true, document_changed: true, fields: %{}}}

          error ->
            error
        end

      {:error, {:not_exist, _}} ->
        {:ok, %{changed: false, document_changed: false, fields: %{}}}

      error ->
        error
    end
  end

  defp document(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article) do
      case Repo.get_by(ArticleDocument, article_id: article.id, thread: thread) do
        nil -> {:error, :document_not_found}
        document -> {:ok, document}
      end
    end
  end
end
