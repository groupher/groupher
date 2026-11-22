defmodule GroupherServer.CMS.DocTree.Publish.ContentState do
  @moduledoc """
  Loads the complete Doc content owned by a WorkingCopy or Snapshot.

      transaction-owned content row -> typed fields, cover, tags and asset refs -> merge input

  Callers own authorization and must read under the appropriate content locks
  or a consistent read-only transaction. Missing dependent content is an error.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleSnapshot,
    ArticleWorkingCopy,
    CoverEditSnapshot,
    CoverEditWorkingCopy
  }

  @cover_fields ~w(format_version canvas_width canvas_height light dark)a
  @asset_fields ~w(asset_id usage position block_id block_type alt title source meta)a

  @doc "Loads one already authorized Doc content owner with its complete dependent fields."
  def load(%ArticleWorkingCopy{} = work) do
    with {:ok, :pass} <- doc_owner(work.article_id),
         {:ok, fields} <- CMS.Articles.working_copy_thread_fields(work),
         {:ok, tags} <- CMS.Articles.working_copy_tag_ids(work),
         {:ok, cover} <- cover(CoverEditWorkingCopy, work.cover_edit_working_copy_id) do
      {:ok, build(work, fields, tags, cover, refs(:working_copy_id, work.id))}
    end
  end

  def load(%ArticleSnapshot{} = snapshot) do
    with {:ok, :pass} <- doc_owner(snapshot.article_id),
         {:ok, fields} <- CMS.Articles.snapshot_thread_fields(snapshot),
         {:ok, tags} <- CMS.Articles.snapshot_tag_ids(snapshot),
         {:ok, cover} <- cover(CoverEditSnapshot, snapshot.cover_edit_snapshot_id) do
      {:ok, build(snapshot, fields, tags, cover, refs(:snapshot_id, snapshot.id))}
    end
  end

  def load(_owner), do: {:error, :invalid_doc_content_owner}

  defp doc_owner(article_id) do
    case Repo.get(Article, article_id) do
      %Article{thread: :doc} -> {:ok, :pass}
      %Article{} -> {:error, :not_a_doc}
      nil -> {:error, :article_not_found}
    end
  end

  defp cover(_model, nil), do: {:ok, nil}

  defp cover(model, id) do
    case Repo.get(model, id) do
      nil -> {:error, :cover_edit_not_found}
      cover -> {:ok, Map.take(cover, @cover_fields)}
    end
  end

  defp refs(owner_field, owner_id) do
    Repo.all(
      from(ref in ArticleAssetRef,
        where:
          field(ref, ^owner_field) == ^owner_id and
            ref.usage in [:attachment, :cover, :cover_dark],
        select: map(ref, ^@asset_fields)
      )
    )
  end

  defp build(owner, typed, tags, cover, refs) do
    owner
    |> Map.take([:title, :digest, :slug])
    |> Map.merge(typed)
    |> Map.put(:body, CMS.Articles.Body.document(owner))
    |> Map.put(:tags, tags)
    |> Map.put(:cover_edit, cover)
    |> Map.put(
      :asset_refs,
      Enum.filter(refs, &(&1.usage == :attachment and &1.source != "plate"))
    )
    |> Map.put(:cover_refs, Enum.filter(refs, &(&1.usage in [:cover, :cover_dark])))
  end
end
