defmodule GroupherServer.CMS.DocTree.Publish.Queue.Dequeue do
  @moduledoc """
  Removes Queue members and their copies after locked discard confirmation.

      admitted Docs command -> site / Queue / content locks -> confirmation -> remove Q

  The caller owns Gate, Lifecycle and tree dependency handling, supplies the
  complete operation, and must roll back the transaction on every error. The
  Queue revision is advanced once here; an encompassing tree operation must
  not advance it again for changes belonging to the same command.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.WorkingCopy.Deleter
  alias CMS.DocTree.Publish.{ContentState, Queue}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    DocsPublishQueue,
    DocsQueueArticle
  }

  @doc "Removes the complete affected batch after validating the bound confirmation."
  def remove_many(community, queue, revision, ids, operation, confirmation, operation_ref)

  def remove_many(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        ids,
        operation,
        confirmation,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_list(ids) and is_map(operation) do
    with {:ok, ids} <- normalize_ids(ids),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         {:ok, locked} <- load_locked(community, queue, ids),
         {:ok, _} <- Queue.check_discard(operation, revision, locked.documents, confirmation),
         {:ok, :pass} <- remove_members(locked),
         {:ok, queue} <-
           Queue.advance(
             community,
             queue,
             %{queue_revision: revision},
             [:queue_revision],
             operation_ref
           ) do
      {:ok, %{queue: queue, article_ids: ids}}
    end
  end

  def remove_many(_, _, _, _, _, _, _), do: {:error, :invalid_queue_members}

  @doc false
  def normalize_ids([]), do: {:error, :invalid_queue_members}

  def normalize_ids(ids) do
    Enum.reduce_while(ids, {:ok, MapSet.new()}, fn id, {:ok, result} ->
      case Ecto.UUID.cast(id) do
        {:ok, id} ->
          if MapSet.member?(result, id) do
            {:halt, {:error, :invalid_queue_members}}
          else
            {:cont, {:ok, MapSet.put(result, id)}}
          end

        :error ->
          {:halt, {:error, :invalid_queue_members}}
      end
    end)
    |> case do
      {:ok, result} -> {:ok, result |> MapSet.to_list() |> Enum.sort()}
      error -> error
    end
  end

  @doc false
  def load_locked(community, queue, ids) do
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

    members =
      Repo.all(
        from(m in DocsQueueArticle,
          where: m.queue_id == ^queue.id and m.article_id in ^ids,
          order_by: m.article_id,
          lock: "FOR UPDATE"
        )
      )

    copy_ids = Enum.map(members, & &1.working_copy_id)
    snapshot_ids = Enum.map(members, & &1.source_snapshot_id)

    works =
      Repo.all(
        from(w in ArticleWorkingCopy,
          where: w.article_id in ^ids and (w.scope_type == :default or w.id in ^copy_ids),
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

    cond do
      length(articles) != length(ids) or Enum.any?(articles, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_identity}

      length(bindings) != length(ids) or Enum.any?(bindings, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_binding}

      length(members) != length(ids) ->
        {:error, :queue_member_not_found}

      true ->
        build_documents(queue, articles, members, works, snapshots)
    end
  end

  defp build_documents(queue, articles, members, works, snapshots) do
    defaults = Map.new(Enum.filter(works, &(&1.scope_type == :default)), &{&1.article_id, &1})
    copies = Map.new(works, &{&1.id, &1})
    snapshots = Map.new(snapshots, &{&1.id, &1})
    articles = Map.new(articles, &{&1.id, &1})

    Enum.reduce_while(members, {:ok, [], []}, fn member, {:ok, documents, rows} ->
      with %ArticleWorkingCopy{} = default <- defaults[member.article_id],
           true <- default.scope_id == member.article_id,
           %ArticleWorkingCopy{} = copy <- copies[member.working_copy_id],
           true <-
             copy.article_id == member.article_id and copy.scope_type == :workspace and
               copy.scope_id == queue.id,
           %ArticleSnapshot{} = source <- snapshots[member.source_snapshot_id],
           true <-
             source.article_id == member.article_id and
               source.source_working_copy_id == default.id,
           {:ok, default_content} <- ContentState.load(default),
           {:ok, queue_content} <- ContentState.load(copy),
           {:ok, source_content} <- ContentState.load(source) do
        document = %{
          article_id: member.article_id,
          default_revision: default.revision,
          source: source_content,
          queue: queue_content,
          default: default_content
        }

        row = %{article: Map.fetch!(articles, member.article_id), member: member, copy: copy}
        {:cont, {:ok, [document | documents], [row | rows]}}
      else
        {:error, _reason} = error -> {:halt, error}
        _ -> {:halt, {:error, :invalid_queue_member_owner}}
      end
    end)
    |> case do
      {:ok, documents, rows} ->
        {:ok, %{documents: Enum.reverse(documents), rows: Enum.reverse(rows)}}

      error ->
        error
    end
  end

  @doc false
  def remove_members(locked) do
    Enum.reduce_while(locked.rows, {:ok, :pass}, fn row, _ ->
      with {:ok, _} <- Repo.delete(row.member),
           {:ok, :deleted} <- Deleter.delete_in_transaction(row.article, row.copy) do
        {:cont, {:ok, :pass}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end
end
