defmodule GroupherServer.CMS.DocTree.Publish.AlignDefault do
  @moduledoc """
  Aligns a Doc default WorkingCopy to its selected Queue publication.

      admitted Release -> locked source, Q, Public and D -> merged D or conflict facts

  A conflict is recorded before the Release removes the member. The caller
  must roll back every error; this step owns neither admission nor a transaction.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store
  alias CMS.DocTree.Publish.{ContentMerge, ContentState, Queue}
  alias CMS.DocTree.Publish.Queue.Save

  alias CMS.Model.{
    ArticlePublic,
    ArticleSnapshot,
    Community,
    DocsPostPublishConflict,
    DocsPublishQueue
  }

  @fields ~w(title digest slug subtitle link_addr template_key cover_url cover_url_dark cover_edit)a

  @doc "Marks clean D for consumption, merges unpublished edits, or records conflicts for the enclosing Release."
  def align(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        queue_revision,
        article_id,
        work_revision,
        snapshot_id,
        %User{id: actor_id} = actor
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(work_revision) and work_revision > 0 and is_binary(snapshot_id) and
             is_integer(actor_id) and actor_id > 0 do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, snapshot_id} <- Ecto.UUID.cast(snapshot_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: queue_revision}, []),
         %User{} <- Repo.get(User, actor_id),
         {:ok, locked} <- Save.lock_member(community, queue, article_id, work_revision),
         %ArticleSnapshot{} = released <-
           Repo.one(from(s in ArticleSnapshot, where: s.id == ^snapshot_id, lock: "FOR SHARE")),
         true <-
           released.article_id == article_id and released.source_working_copy_id == locked.work.id and
             released.source_revision == work_revision,
         %ArticlePublic{snapshot_id: ^snapshot_id} <-
           Repo.one(
             from(p in ArticlePublic, where: p.article_id == ^article_id, lock: "FOR UPDATE")
           ),
         {:ok, base} <- ContentState.load(locked.source),
         {:ok, source} <- ContentState.load(released),
         {:ok, target} <- ContentState.load(locked.default),
         {:ok, default_changes} <- ContentMerge.exclusive_changes(base, target, base) do
      mode = if default_changes == [], do: :fast_forward, else: :merge
      align_content(community, locked, released, base, source, target, actor, mode)
    else
      :error -> {:error, :invalid_doc_alignment}
      nil -> {:error, :doc_alignment_source_or_actor_not_found}
      false -> {:error, :doc_alignment_source_mismatch}
      %ArticlePublic{} -> {:error, :public_conflict}
      {:error, _reason} = error -> error
    end
  end

  def align(_, _, _, _, _, _, _), do: {:error, :invalid_doc_alignment}

  defp align_content(community, locked, released, base, source, target, actor, mode) do
    case ContentMerge.merge(base, source, target, mode: mode) do
      {:error, {:merge_conflict, fields}} ->
        attrs = %{
          community_id: community.id,
          article_id: locked.article.id,
          base_snapshot_id: locked.source.id,
          published_snapshot_id: released.id,
          default_revision: locked.default.revision
        }

        with {:ok, conflict} <-
               %DocsPostPublishConflict{}
               |> DocsPostPublishConflict.changeset(attrs)
               |> Repo.insert() do
          {:ok,
           %{
             status: :conflict,
             fields: fields,
             conflict: conflict,
             default_revision: locked.default.revision,
             base_snapshot_id: locked.source.id,
             published_snapshot_id: released.id
           }}
        end

      {:ok, selected} ->
        with {:ok, unpublished} <- ContentMerge.exclusive_changes(source, selected.fields, source),
             {:ok, changed} <- ContentMerge.exclusive_changes(target, selected.fields, target) do
          cond do
            unpublished == [] ->
              {:ok, %{status: :clean, working_copy: locked.default}}

            changed == [] ->
              {:ok, %{status: :unchanged, working_copy: locked.default}}

            true ->
              save(community, locked.default, released, selected, actor, mode)
          end
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp save(community, default, released, selected, actor, mode) do
    attrs =
      selected.fields
      |> Map.take(@fields)
      |> Map.put(:tag_ids, selected.fields.tags)
      |> Map.put(:asset_refs, selected.fields.asset_refs)

    body_source = if selected.origins.body == :source, do: released, else: default

    with {:ok, saved} <-
           Store.save_merged_loaded(
             default,
             body_source,
             attrs,
             selected.fields.cover_refs,
             actor,
             default.revision,
             community.id
           ) do
      {:ok, %{status: mode, working_copy: saved}}
    end
  end
end
