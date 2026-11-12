defmodule GroupherServer.CMS.DocTree.Publish.SelectPublic do
  @moduledoc """
  Selects a checked Queue Snapshot as the Doc's ArticlePublic in a Release transaction.

      admitted Release -> site and Queue locks -> Doc / Q / Snapshot -> ArticlePublic

  The enclosing Release owns Gate, Lifecycle, numbering, directory, review,
  stats, mentions, effects, Receipt and rollback. This step cannot publish a
  standalone Doc or commit independently.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Public, Publishable}
  alias CMS.DocTree.Publish.Queue
  alias CMS.DocTree.Publish.Queue.Save
  alias CMS.Model.{ArticlePublic, ArticleSnapshot, Community, DocsPublishQueue}

  @doc "Selects the checked Queue Snapshot while enforcing the expected current Public head."
  def select(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        queue_revision,
        article_id,
        work_revision,
        snapshot_id,
        expected_public_id,
        %User{id: actor_id} = actor,
        %DateTime{} = published_at
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(work_revision) and work_revision > 0 and is_binary(snapshot_id) and
             (is_nil(expected_public_id) or is_binary(expected_public_id)) and
             is_integer(actor_id) and actor_id > 0 and published_at.utc_offset == 0 and
             published_at.std_offset == 0 do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, snapshot_id} <- Ecto.UUID.cast(snapshot_id),
         {:ok, expected_public_id} <- cast_optional_id(expected_public_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: queue_revision}, []),
         %User{} <- Repo.get(User, actor_id),
         {:ok, locked} <- Save.lock_member(community, queue, article_id, work_revision),
         %ArticleSnapshot{} = snapshot <- lock_snapshot(snapshot_id),
         true <-
           snapshot.article_id == article_id and snapshot.source_working_copy_id == locked.work.id and
             snapshot.source_revision == work_revision,
         {:ok, :pass} <- Publishable.validate(snapshot),
         public <- lock_public(article_id),
         {:ok, :pass} <- ensure_head(public, expected_public_id),
         {:ok, selected} <-
           Public.select_snapshot(locked.article, snapshot, actor, published_at: published_at) do
      {:ok, %{public: selected, snapshot: snapshot, first_publish?: is_nil(public)}}
    else
      :error -> {:error, :invalid_doc_public_selection}
      nil -> {:error, :doc_public_source_or_actor_not_found}
      false -> {:error, :doc_public_source_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def select(_, _, _, _, _, _, _, _, _), do: {:error, :invalid_doc_public_selection}

  defp cast_optional_id(nil), do: {:ok, nil}
  defp cast_optional_id(id), do: Ecto.UUID.cast(id)

  defp lock_snapshot(id) do
    Repo.one(from(s in ArticleSnapshot, where: s.id == ^id, lock: "FOR SHARE"))
  end

  defp lock_public(article_id) do
    Repo.one(from(p in ArticlePublic, where: p.article_id == ^article_id, lock: "FOR UPDATE"))
  end

  defp ensure_head(nil, nil), do: {:ok, :pass}
  defp ensure_head(%ArticlePublic{snapshot_id: id}, id), do: {:ok, :pass}
  defp ensure_head(_, _), do: {:error, :public_conflict}
end
