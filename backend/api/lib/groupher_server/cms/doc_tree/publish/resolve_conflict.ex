defmodule GroupherServer.CMS.DocTree.Publish.ResolveConflict do
  @moduledoc """
  Resolves a post-publication Doc conflict in a caller-owned transaction.

      admitted command -> site / Doc / Public / conflict locks -> D save -> unblock

  Gate, Lifecycle, Receipt, effects and rollback remain with the Docs command.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store
  alias CMS.DocTree.DefaultCopy
  alias CMS.DocTree.Publish.{ContentMerge, ContentState, SiteLock}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    DocsPostPublishConflict
  }

  @fields ~w(title digest slug subtitle link_addr template_key cover_url cover_url_dark cover_edit)a

  @doc "Resolves against the current D revision and published Snapshot, then removes the blocker."
  def resolve(
        %Community{} = community,
        article_id,
        working_copy_id,
        default_revision,
        public_snapshot_id,
        choices,
        %User{id: actor_id} = actor
      )
      when is_binary(article_id) and is_binary(working_copy_id) and is_integer(default_revision) and
             default_revision > 0 and
             is_binary(public_snapshot_id) and is_map(choices) and is_integer(actor_id) and
             actor_id > 0 do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, public_snapshot_id} <- Ecto.UUID.cast(public_snapshot_id),
         {:ok, :acquired} <- SiteLock.acquire(community),
         %User{} <- Repo.get(User, actor_id),
         %Article{thread: :doc} <-
           Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE")),
         %ArticleBinding{thread: :doc} <-
           Repo.one(
             from(b in ArticleBinding,
               where: b.article_id == ^article_id and b.community_id == ^community.id,
               lock: "FOR SHARE"
             )
           ),
         %ArticleWorkingCopy{} = default <-
           Repo.one(
             from(w in ArticleWorkingCopy,
               where: w.article_id == ^article_id and w.scope_kind == :default,
               lock: "FOR UPDATE"
             )
           ),
         true <- default.scope_id == article_id and default.id == working_copy_id,
         {:ok, :pass} <- check_revision(default, default_revision),
         %ArticlePublic{snapshot_id: ^public_snapshot_id} <-
           Repo.one(
             from(p in ArticlePublic, where: p.article_id == ^article_id, lock: "FOR UPDATE")
           ),
         %DocsPostPublishConflict{published_snapshot_id: ^public_snapshot_id} = conflict <-
           Repo.one(
             from(c in DocsPostPublishConflict,
               where: c.article_id == ^article_id and c.community_id == ^community.id,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, base, source} <- snapshots(article_id, conflict),
         {:ok, base_content} <- ContentState.load(base),
         {:ok, source_content} <- ContentState.load(source),
         {:ok, default_content} <- ContentState.load(default),
         {:ok, selection} <-
           ContentMerge.merge(base_content, source_content, default_content, choices: choices),
         {:ok, changed} <-
           ContentMerge.exclusive_changes(default_content, selection.fields, default_content),
         {:ok, unpublished} <-
           ContentMerge.exclusive_changes(source_content, selection.fields, source_content),
         {:ok, _} <- Repo.delete(conflict),
         {:ok, saved} <-
           finish(community, default, source, selection, changed, unpublished, actor) do
      {:ok, %{article_id: article_id, working_copy: saved, changed_fields: changed}}
    else
      :error -> {:error, :invalid_doc_conflict_resolution}
      nil -> {:error, :doc_conflict_or_owner_not_found}
      false -> {:error, :invalid_doc_default_owner}
      %ArticlePublic{} -> {:error, :public_conflict}
      %DocsPostPublishConflict{} -> {:error, :public_conflict}
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_doc_conflict_owner}
    end
  end

  def resolve(_, _, _, _, _, _, _), do: {:error, :invalid_doc_conflict_resolution}

  defp finish(community, default, _source, _selection, _changed, [], _actor) do
    with {:ok, :deleted} <- DefaultCopy.remove(community, default), do: {:ok, nil}
  end

  defp finish(community, default, source, selection, changed, _unpublished, actor) do
    save_if_changed(community, default, source, selection, changed, actor)
  end

  defp check_revision(%{revision: revision}, revision), do: {:ok, :pass}

  defp check_revision(%{article_id: id, revision: actual}, _revision) do
    {:error, {:default_revision_conflict, id, actual}}
  end

  defp snapshots(article_id, conflict) do
    ids = [conflict.base_snapshot_id, conflict.published_snapshot_id] |> Enum.uniq()

    found =
      Repo.all(
        from(s in ArticleSnapshot,
          where: s.article_id == ^article_id and s.id in ^ids,
          order_by: s.id,
          lock: "FOR SHARE"
        )
      )
      |> Map.new(&{&1.id, &1})

    case {found[conflict.base_snapshot_id], found[conflict.published_snapshot_id]} do
      {%ArticleSnapshot{} = base, %ArticleSnapshot{} = source} -> {:ok, base, source}
      _ -> {:error, :doc_conflict_snapshot_not_found}
    end
  end

  defp save_if_changed(_community, default, _source, _selection, [], _actor), do: {:ok, default}

  defp save_if_changed(community, default, source, selection, _changed, actor) do
    attrs =
      selection.fields
      |> Map.take(@fields)
      |> Map.put(:tag_ids, selection.fields.tags)
      |> Map.put(:asset_refs, selection.fields.asset_refs)

    body = if selection.origins.body == :source, do: source, else: default

    Store.save_merged_loaded(
      default,
      body,
      attrs,
      selection.fields.cover_refs,
      actor,
      default.revision,
      community.id
    )
  end
end
