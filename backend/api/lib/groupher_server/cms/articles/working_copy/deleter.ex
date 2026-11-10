defmodule GroupherServer.CMS.Articles.WorkingCopy.Deleter do
  @moduledoc """
  Deletes an eligible WorkingCopy and its own tag, asset, and CoverEdit rows in the caller transaction.

      locked Article / WorkingCopy -> dependent owner rows -> WorkingCopy delete -> typed result
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticlePublic,
    ArticleWorkingCopy,
    ArticleWorkingCopyBlog,
    ArticleWorkingCopyChangelog,
    ArticleWorkingCopyDoc,
    ArticleWorkingCopyPost,
    ArticleWorkingCopyTag,
    CoverEditWorkingCopy
  }

  @doc "Deletes a locked Article-owned WorkingCopy, returning `work_in_use` for an external FK."
  def delete_in_transaction(%Article{} = article, %ArticleWorkingCopy{} = work) do
    with true <- Repo.in_transaction?(),
         true <- work.article_id == article.id,
         {:ok, public} <- public_head(article.id),
         {:ok, :pass} <- protect_last_unpublished(article.id, public),
         {:ok, :pass} <- delete_asset_refs(work.id),
         {:ok, :pass} <- delete_tag_rows(work.id),
         {:ok, :pass} <- delete_typed_row(article.thread, work.id),
         {:ok, cover_id} <- delete_work_parent(work),
         {:ok, :pass} <- delete_cover(cover_id) do
      {:ok, :deleted}
    else
      false -> {:error, :snapshot_owner_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def delete_in_transaction(_article, _work), do: {:error, :invalid_working_copy}

  defp public_head(article_id) do
    {:ok, Repo.get(ArticlePublic, article_id)}
  end

  defp protect_last_unpublished(_article_id, %ArticlePublic{}), do: {:ok, :pass}

  defp protect_last_unpublished(article_id, nil) do
    case Repo.aggregate(
           from(work in ArticleWorkingCopy, where: work.article_id == ^article_id),
           :count,
           :id
         ) do
      1 -> {:error, :last_unpublished_work}
      _ -> {:ok, :pass}
    end
  end

  defp delete_asset_refs(working_copy_id) do
    safe_delete_all(from(ref in ArticleAssetRef, where: ref.working_copy_id == ^working_copy_id))
  end

  defp delete_tag_rows(working_copy_id) do
    safe_delete_all(
      from(tag in ArticleWorkingCopyTag, where: tag.working_copy_id == ^working_copy_id)
    )
  end

  defp delete_typed_row(:post, id), do: delete_one(ArticleWorkingCopyPost, id)
  defp delete_typed_row(:blog, id), do: delete_one(ArticleWorkingCopyBlog, id)
  defp delete_typed_row(:changelog, id), do: delete_one(ArticleWorkingCopyChangelog, id)
  defp delete_typed_row(:doc, id), do: delete_one(ArticleWorkingCopyDoc, id)
  defp delete_typed_row(_thread, _id), do: {:ok, :pass}

  defp delete_one(model, id) do
    safe_delete_all(from(row in model, where: row.working_copy_id == ^id))
  end

  defp delete_work_parent(work) do
    cover_id = work.cover_edit_working_copy_id

    try do
      case Repo.delete(work) do
        {:ok, _deleted} -> {:ok, cover_id}
        {:error, _changeset} -> {:error, :working_copy_delete_failed}
      end
    rescue
      error in Postgrex.Error ->
        Repo.rollback(parent_delete_error(error))

      error in Ecto.ConstraintError ->
        Repo.rollback(parent_delete_error(error))
    end
  end

  defp delete_cover(nil), do: {:ok, :pass}

  defp delete_cover(id) do
    try do
      case Repo.delete(Repo.get!(CoverEditWorkingCopy, id)) do
        {:ok, _cover} -> {:ok, :pass}
        {:error, _changeset} -> {:error, :cover_edit_delete_failed}
      end
    rescue
      error in [Postgrex.Error, Ecto.ConstraintError] ->
        _ = error
        {:error, :cover_edit_delete_failed}
    end
  end

  defp safe_delete_all(query) do
    Repo.delete_all(query)
    {:ok, :pass}
  rescue
    error in [Postgrex.Error, Ecto.ConstraintError] ->
      _ = error
      {:error, :working_copy_children_delete_failed}
  end

  defp parent_delete_error(%Postgrex.Error{postgres: %{code: :foreign_key_violation}}),
    do: :work_in_use

  defp parent_delete_error(%Ecto.ConstraintError{type: :foreign_key}), do: :work_in_use
  defp parent_delete_error(_error), do: :working_copy_delete_failed
end
