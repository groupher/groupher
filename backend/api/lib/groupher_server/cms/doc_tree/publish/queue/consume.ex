defmodule GroupherServer.CMS.DocTree.Publish.Queue.Consume do
  @moduledoc """
  Consumes published Queue copies after their exact Snapshots become public.

      admitted Release -> locked full Queue -> checked public heads -> delete Q -> next revision

  The enclosing Release must validate its full plan and approval, align D or
  record a conflict, persist Release and tree state, own Gate/Receipt/effects,
  and roll back every error. It must not advance the Queue revision twice.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.{DefaultCopy, Publish}
  alias Publish.{ContentMerge, ContentState, Queue, TreeCodec, TreeOperations}
  alias Publish.Queue.Dequeue
  alias CMS.Model.ArticleWorkingCopy

  alias CMS.Model.{
    ArticlePublic,
    ArticleSnapshot,
    Community,
    DocsPostPublishConflict,
    DocsPublishQueue,
    DocsQueueArticle,
    DocsQueueTreeChange,
    DocsRelease,
    DocsReleaseArticle,
    DocsReleaseTreeSnapshot
  }

  @doc "Consumes the whole Queue only after its sealed Release matches its contents."
  def release(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        release_id,
        entries
      )
      when is_integer(revision) and revision >= 0 and is_integer(release_id) and release_id > 0 and
             is_list(entries) do
    with {:ok, entries} <- normalize_release_entries(entries),
         ids = Enum.map(entries, & &1.article_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         true <- all_members?(queue.id, ids),
         %DocsRelease{sealed: true, queue_revision: ^revision} = release <-
           Repo.one(
             from(r in DocsRelease,
               where: r.id == ^release_id and r.community_id == ^community.id,
               lock: "FOR SHARE"
             )
           ),
         true <- queue.public_release_id == release.id,
         {:ok, changes} <- check_release_tree(queue.id, community.id, release),
         true <- entries != [] or changes != [],
         {:ok, :pass} <- check_release_articles(release.id, entries),
         {:ok, locked} <- lock_content(community, queue, ids),
         {:ok, :pass} <- check_publications(community, locked, entries),
         {:ok, :pass} <- Dequeue.remove_members(locked),
         {:ok, :pass} <- remove_clean_defaults(community, locked, entries),
         {_count, nil} <-
           Repo.delete_all(from(c in DocsQueueTreeChange, where: c.queue_id == ^queue.id)),
         {:ok, updated} <-
           Queue.advance(
             community,
             queue,
             %{
               queue_revision: revision,
               public_presentation_revision: queue.public_presentation_revision
             },
             [:queue_revision, :public_presentation_revision]
           ) do
      {:ok, %{queue: updated, article_ids: ids, tree_changes_consumed: length(changes)}}
    else
      nil -> {:error, :docs_release_not_found}
      false -> {:error, :docs_release_queue_mismatch}
      %DocsRelease{} -> {:error, :docs_release_queue_mismatch}
      {:error, _reason} = error -> error
    end
  end

  def release(_, _, _, _, _), do: {:error, :invalid_queue_members}

  defp normalize_release_entries([]), do: {:ok, []}
  defp normalize_release_entries(entries), do: normalize(entries)

  defp lock_content(_community, _queue, []), do: {:ok, %{rows: [], documents: []}}
  defp lock_content(community, queue, ids), do: Dequeue.load_locked(community, queue, ids)

  defp check_release_articles(release_id, entries) do
    records =
      Repo.all(
        from(m in DocsReleaseArticle,
          where: m.release_id == ^release_id and m.action == :publish,
          order_by: m.article_id,
          select: {m.article_id, m.snapshot_id}
        )
      )

    expected = Enum.map(entries, &{&1.article_id, &1.snapshot_id})
    if records == expected, do: {:ok, :pass}, else: {:error, :docs_release_members_mismatch}
  end

  defp check_release_tree(queue_id, community_id, release) do
    rows =
      Repo.all(
        from(c in DocsQueueTreeChange,
          where: c.queue_id == ^queue_id,
          order_by: c.node_id,
          lock: "FOR UPDATE"
        )
      )

    with {:ok, baseline} <- release_tree(community_id, release.base_release_id),
         {:ok, target} <- release_tree(community_id, release.id),
         {:ok, changes} <- TreeCodec.decode_changes(rows),
         {:ok, plan} <- TreeOperations.plan(baseline, changes),
         true <- plan.target == target do
      {:ok, changes}
    else
      _ -> {:error, :docs_release_tree_mismatch}
    end
  end

  defp release_tree(_community_id, nil), do: {:ok, []}

  defp release_tree(community_id, id) do
    tree =
      Repo.one(
        from(r in DocsRelease,
          join: s in DocsReleaseTreeSnapshot,
          on: s.id == r.tree_snapshot_id,
          where:
            r.id == ^id and r.community_id == ^community_id and
              s.community_id == ^community_id and r.sealed == true,
          select: s.tree_json,
          lock: "FOR SHARE"
        )
      )

    TreeCodec.decode(tree)
  end

  defp normalize(entries) do
    Enum.reduce_while(entries, {:ok, %{}}, fn entry, {:ok, result} ->
      with %{article_id: id, snapshot_id: snapshot_id, work_revision: revision} <- entry,
           {:ok, id} <- Ecto.UUID.cast(id),
           {:ok, snapshot_id} <- Ecto.UUID.cast(snapshot_id),
           true <- is_integer(revision) and revision > 0,
           false <- Map.has_key?(result, id) do
        {:cont,
         {:ok,
          Map.put(result, id, %{article_id: id, snapshot_id: snapshot_id, work_revision: revision})}}
      else
        _ -> {:halt, {:error, :invalid_queue_members}}
      end
    end)
    |> case do
      {:ok, result} when map_size(result) > 0 ->
        {:ok, result |> Map.values() |> Enum.sort_by(& &1.article_id)}

      {:ok, _} ->
        {:error, :invalid_queue_members}

      error ->
        error
    end
  end

  defp all_members?(queue_id, ids) do
    Repo.all(
      from(m in DocsQueueArticle,
        where: m.queue_id == ^queue_id,
        order_by: m.article_id,
        select: m.article_id
      )
    ) == ids
  end

  defp check_publications(community, locked, entries) do
    ids = Enum.map(entries, & &1.article_id)
    snapshot_ids = Enum.map(entries, & &1.snapshot_id)

    snapshots =
      Repo.all(
        from(s in ArticleSnapshot,
          where: s.id in ^snapshot_ids,
          order_by: s.id,
          lock: "FOR SHARE"
        )
      )
      |> Map.new(&{&1.id, &1})

    publics =
      Repo.all(
        from(p in ArticlePublic,
          where: p.article_id in ^ids,
          order_by: p.article_id,
          lock: "FOR UPDATE"
        )
      )
      |> Map.new(&{&1.article_id, &1})

    by_article = Map.new(locked.rows, &{&1.article.id, &1})
    documents = Map.new(locked.documents, &{&1.article_id, &1})

    conflicts =
      Repo.all(
        from(c in DocsPostPublishConflict,
          where: c.community_id == ^community.id and c.article_id in ^ids,
          order_by: c.article_id,
          lock: "FOR UPDATE"
        )
      )
      |> Map.new(&{&1.article_id, &1})

    Enum.reduce_while(entries, {:ok, :pass}, fn entry, _ ->
      row = by_article[entry.article_id]
      snapshot = snapshots[entry.snapshot_id]
      public = publics[entry.article_id]

      if match?(%ArticleSnapshot{}, snapshot) and match?(%ArticlePublic{}, public) and
           row.copy.revision == entry.work_revision and snapshot.article_id == entry.article_id and
           snapshot.source_working_copy_id == row.copy.id and
           snapshot.source_revision == entry.work_revision and
           public.snapshot_id == entry.snapshot_id do
        case check_alignment(
               documents[entry.article_id],
               row,
               snapshot,
               conflicts[entry.article_id]
             ) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      else
        {:halt, {:error, :queue_publication_mismatch}}
      end
    end)
  end

  defp check_alignment(document, row, snapshot, conflict) do
    with {:ok, published} <- ContentState.load(snapshot),
         {:ok, d_changes} <-
           ContentMerge.exclusive_changes(document.source, document.default, document.source) do
      mode = if d_changes == [], do: :fast_forward, else: :merge

      case ContentMerge.merge(document.source, published, document.default, mode: mode) do
        {:error, {:merge_conflict, _fields}} ->
          if match?(%DocsPostPublishConflict{}, conflict) and
               conflict.base_snapshot_id == row.member.source_snapshot_id and
               conflict.published_snapshot_id == snapshot.id and
               conflict.default_revision == document.default_revision do
            {:ok, :pass}
          else
            {:error, {:default_alignment_required, row.article.id}}
          end

        {:ok, selected} ->
          with {:ok, changed} <-
                 ContentMerge.exclusive_changes(
                   document.default,
                   selected.fields,
                   document.default
                 ) do
            {:ok, unpublished} =
              ContentMerge.exclusive_changes(published, selected.fields, published)

            if is_nil(conflict) and (unpublished == [] or changed == []) do
              {:ok, :pass}
            else
              {:error, {:default_alignment_required, row.article.id}}
            end
          end

        {:error, _reason} = error ->
          error
      end
    end
  end

  defp remove_clean_defaults(community, locked, entries) do
    documents = Map.new(locked.documents, &{&1.article_id, &1})

    Enum.reduce_while(entries, {:ok, :pass}, fn entry, _ ->
      document = documents[entry.article_id]
      snapshot = Repo.get!(ArticleSnapshot, entry.snapshot_id)

      with {:ok, published} <- ContentState.load(snapshot),
           {:ok, changes} <-
             ContentMerge.exclusive_changes(document.source, document.default, document.source),
           {:ok, selected} <-
             ContentMerge.merge(document.source, published, document.default,
               mode: if(changes == [], do: :fast_forward, else: :merge)
             ),
           {:ok, unpublished} <-
             ContentMerge.exclusive_changes(published, selected.fields, published) do
        if unpublished == [] do
          work =
            Repo.one!(
              from(w in ArticleWorkingCopy,
                where: w.article_id == ^entry.article_id and w.scope_type == :default
              )
            )

          case DefaultCopy.remove(community, work) do
            {:ok, :deleted} -> {:cont, {:ok, :pass}}
            error -> {:halt, error}
          end
        else
          {:cont, {:ok, :pass}}
        end
      else
        {:error, {:merge_conflict, _}} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
  end
end
