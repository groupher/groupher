defmodule GroupherServer.CMS.DocTree.Publish.Queue.Members do
  @moduledoc """
  Registers a batch of already-forked Doc Queue copies in a caller-owned transaction.

      admitted Docs command -> site and Queue locks -> Doc owners -> members + contributors

  The caller authorizes each Doc, creates the source Snapshot and independent
  Queue copy, validates publication and tree dependencies, and rolls back the
  transaction on any error. This module never commits or owns Gate admission.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{ContentMerge, ContentState, Queue}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    DocsPostPublishConflict,
    DocsPublishQueue,
    DocsQueueArticle,
    DocsQueueArticleContributor
  }

  @doc "Registers an entire batch and advances the Queue revision exactly once."
  def add_many(%Community{} = community, %DocsPublishQueue{} = queue, revision, entries, %User{
        id: user_id
      })
      when is_integer(revision) and revision >= 0 and is_list(entries) and
             is_integer(user_id) and user_id > 0 do
    with {:ok, entries} <- normalize_entries(entries),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, user_id),
         {:ok, :pass} <- lock_and_validate(community, queue, entries),
         {:ok, members} <- insert_members(queue, entries, user_id),
         {:ok, queue} <-
           Queue.advance(community, queue, %{queue_revision: revision}, [:queue_revision]) do
      {:ok, %{queue: queue, members: members}}
    else
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  def add_many(_community, _queue, _revision, _entries, _actor) do
    {:error, :invalid_queue_members}
  end

  @doc "Records an actor after a successful Q content change; caller advances the Queue revision."
  def record_contribution(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        article_id,
        %User{id: user_id}
      )
      when is_integer(revision) and revision >= 0 and is_binary(article_id) and
             is_integer(user_id) and user_id > 0 do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, user_id),
         %DocsQueueArticle{} <-
           Repo.one(
             from(m in DocsQueueArticle,
               where: m.queue_id == ^queue.id and m.article_id == ^article_id,
               lock: "FOR UPDATE"
             )
           ) do
      {count, _} =
        Repo.insert_all(
          DocsQueueArticleContributor,
          [%{queue_id: queue.id, article_id: article_id, user_id: user_id}],
          on_conflict: :nothing,
          conflict_target: [:queue_id, :article_id, :user_id]
        )

      {:ok, %{added?: count == 1}}
    else
      :error -> {:error, :invalid_queue_members}
      nil -> {:error, :queue_member_or_actor_not_found}
      {:error, _reason} = error -> error
    end
  end

  def record_contribution(_community, _queue, _revision, _article_id, _actor) do
    {:error, :invalid_queue_members}
  end

  defp normalize_entries([]), do: {:error, :invalid_queue_members}

  defp normalize_entries(entries) do
    Enum.reduce_while(entries, {:ok, [], MapSet.new(), MapSet.new()}, fn entry,
                                                                         {:ok, acc, ids, copies} ->
      with %{
             article_id: article,
             working_copy_id: copy,
             source_snapshot_id: snapshot,
             default_revision: revision
           } <- entry,
           {:ok, article} <- Ecto.UUID.cast(article),
           {:ok, copy} <- Ecto.UUID.cast(copy),
           {:ok, snapshot} <- Ecto.UUID.cast(snapshot),
           true <- is_integer(revision) and revision > 0,
           false <- MapSet.member?(ids, article) or MapSet.member?(copies, copy) do
        item = %{
          article_id: article,
          working_copy_id: copy,
          source_snapshot_id: snapshot,
          default_revision: revision
        }

        {:cont, {:ok, [item | acc], MapSet.put(ids, article), MapSet.put(copies, copy)}}
      else
        _ -> {:halt, {:error, :invalid_queue_members}}
      end
    end)
    |> case do
      {:ok, result, _, _} -> {:ok, Enum.sort_by(result, & &1.article_id)}
      error -> error
    end
  end

  defp lock_and_validate(community, queue, entries) do
    ids = Enum.map(entries, & &1.article_id)
    copy_ids = Enum.map(entries, & &1.working_copy_id)
    snapshot_ids = Enum.map(entries, & &1.source_snapshot_id)

    articles =
      Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id, lock: "FOR UPDATE"))

    bindings =
      Repo.all(
        from(b in ArticleBinding,
          where: b.article_id in ^ids and b.community_id == ^community.id,
          order_by: b.article_id,
          lock: "FOR SHARE"
        )
      )

    works =
      Repo.all(
        from(w in ArticleWorkingCopy,
          where: w.article_id in ^ids and (w.scope_kind == :default or w.id in ^copy_ids),
          order_by: w.id,
          lock: "FOR UPDATE"
        )
      )

    snapshots =
      Repo.all(
        from(s in ArticleSnapshot,
          where: s.id in ^snapshot_ids,
          order_by: s.id,
          lock: "FOR SHARE"
        )
      )

    existing =
      Repo.all(
        from(m in DocsQueueArticle,
          where: m.queue_id == ^queue.id and m.article_id in ^ids,
          select: m.article_id
        )
      )

    conflicts =
      Repo.all(
        from(c in DocsPostPublishConflict,
          where: c.community_id == ^community.id and c.article_id in ^ids,
          order_by: c.article_id,
          lock: "FOR UPDATE",
          select: c.article_id
        )
      )

    cond do
      existing != [] ->
        {:error, :already_enqueued}

      conflicts != [] ->
        {:error, {:doc_post_publish_conflicts, conflicts}}

      length(articles) != length(ids) or Enum.any?(articles, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_identity}

      length(bindings) != length(ids) or Enum.any?(bindings, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_binding}

      true ->
        validate_content(entries, queue.id, works, snapshots)
    end
  end

  defp validate_content(entries, queue_id, works, snapshots) do
    defaults = Map.new(Enum.filter(works, &(&1.scope_kind == :default)), &{&1.article_id, &1})
    by_copy = Map.new(works, &{&1.id, &1})
    by_snapshot = Map.new(snapshots, &{&1.id, &1})

    Enum.reduce_while(entries, {:ok, :pass}, fn entry, _ ->
      with %ArticleWorkingCopy{} = default <- defaults[entry.article_id],
           true <- default.scope_id == entry.article_id,
           {:ok, :pass} <- check_default_revision(default, entry.default_revision),
           %ArticleWorkingCopy{} = copy <- by_copy[entry.working_copy_id],
           true <-
             copy.article_id == entry.article_id and copy.scope_kind == :workspace and
               copy.scope_id == queue_id and copy.revision == 1,
           %ArticleSnapshot{} = snapshot <- by_snapshot[entry.source_snapshot_id],
           true <-
             snapshot.article_id == entry.article_id and
               snapshot.source_working_copy_id == default.id and
               snapshot.source_revision == entry.default_revision,
           {:ok, base_content} <- ContentState.load(snapshot),
           {:ok, copy_content} <- ContentState.load(copy),
           {:ok, []} <- ContentMerge.exclusive_changes(base_content, copy_content, base_content) do
        {:cont, {:ok, :pass}}
      else
        {:ok, [_ | _]} -> {:halt, {:error, :queue_copy_not_fork_of_source}}
        {:error, _reason} = error -> {:halt, error}
        _ -> {:halt, {:error, :invalid_queue_member_owner}}
      end
    end)
  end

  defp check_default_revision(%ArticleWorkingCopy{revision: revision}, revision), do: {:ok, :pass}

  defp check_default_revision(%ArticleWorkingCopy{article_id: id, revision: actual}, _expected) do
    {:error, {:default_revision_conflict, id, actual}}
  end

  defp insert_members(queue, entries, user_id) do
    Enum.reduce_while(entries, {:ok, []}, fn entry, {:ok, acc} ->
      attrs =
        entry
        |> Map.delete(:default_revision)
        |> Map.merge(%{queue_id: queue.id, enqueued_by_id: user_id})

      with {:ok, member} <-
             %DocsQueueArticle{} |> DocsQueueArticle.changeset(attrs) |> Repo.insert(),
           {_count, _} <-
             Repo.insert_all(DocsQueueArticleContributor, [
               %{queue_id: queue.id, article_id: member.article_id, user_id: user_id}
             ]) do
        {:cont, {:ok, [member | acc]}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, members} -> {:ok, Enum.reverse(members)}
      error -> error
    end
  end
end
