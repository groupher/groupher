defmodule GroupherServer.CMS.DocTree.Publish.Queue.Enqueue do
  @moduledoc """
  Materializes a batch of independent Queue copies from checked default revisions.

      admitted Docs command -> site and sorted Doc locks -> snapshots + forks -> Queue members

  The caller owns authorization and dependency decisions, Receipt,
  notifications and rollback on every error. This is not a public command.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Publishable, WorkingCopy.Snapshotter}
  alias CMS.DocTree.Publish.{Queue, Lifecycle}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleWorkingCopy,
    Community,
    DocsPostPublishConflict,
    DocsPublishQueue,
    DocsQueueArticle
  }

  @doc "Freezes and forks the whole batch, then registers it with one Queue revision advance."
  def enqueue(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        entries,
        %User{id: actor_id} = actor,
        command_id
      )
      when is_integer(revision) and revision >= 0 and is_list(entries) and
             is_integer(actor_id) and actor_id > 0 and is_binary(command_id) do
    with {:ok, command_id} <- Ecto.UUID.cast(command_id),
         {:ok, entries} <- normalize(entries),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, actor_id),
         {:ok, locked} <- lock_batch(community, queue, entries),
         {:ok, forks} <- fork_batch(locked, queue, actor, command_id),
         {:ok, result} <- Queue.add_many(community, queue, revision, forks, actor) do
      {:ok, result}
    else
      :error -> {:error, :invalid_queue_members}
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  def enqueue(_, _, _, _, _, _), do: {:error, :invalid_queue_members}

  defp normalize([]), do: {:error, :invalid_queue_members}

  defp normalize(entries) do
    entries
    |> Enum.reduce_while({:ok, %{}}, fn entry, {:ok, acc} ->
      with %{article_id: id, default_revision: revision} <- entry,
           {:ok, id} <- Ecto.UUID.cast(id),
           true <- is_integer(revision) and revision > 0,
           false <- Map.has_key?(acc, id) do
        {:cont, {:ok, Map.put(acc, id, revision)}}
      else
        _ -> {:halt, {:error, :invalid_queue_members}}
      end
    end)
    |> case do
      {:ok, by_id} -> {:ok, Enum.sort_by(by_id, &elem(&1, 0))}
      error -> error
    end
  end

  defp lock_batch(community, queue, entries) do
    ids = Enum.map(entries, &elem(&1, 0))

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

    defaults =
      Repo.all(
        from(w in ArticleWorkingCopy,
          where: w.article_id in ^ids and w.scope_kind == :default,
          order_by: w.id,
          lock: "FOR UPDATE"
        )
      )

    existing =
      Repo.exists?(
        from(m in DocsQueueArticle, where: m.queue_id == ^queue.id and m.article_id in ^ids)
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
      existing ->
        {:error, :already_enqueued}

      conflicts != [] ->
        {:error, {:doc_post_publish_conflicts, conflicts}}

      length(articles) != length(ids) or Enum.any?(articles, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_identity}

      length(bindings) != length(ids) or Enum.any?(bindings, &(&1.thread != :doc)) ->
        {:error, :invalid_doc_binding}

      true ->
        with {:ok, locked} <- validate_defaults(entries, articles, defaults),
             {:ok, lifecycles} <- Lifecycle.lock(community, ids, []),
             true <-
               Enum.all?(locked, fn {article, default} ->
                 lifecycles[article.id].default_working_copy_id == default.id
               end) do
          {:ok, locked}
        else
          false -> {:error, :invalid_doc_lifecycle}
          {:error, _reason} = error -> error
        end
    end
  end

  defp validate_defaults(entries, articles, defaults) do
    articles = Map.new(articles, &{&1.id, &1})
    defaults = Map.new(defaults, &{&1.article_id, &1})

    Enum.reduce_while(entries, {:ok, []}, fn {id, revision}, {:ok, acc} ->
      case defaults[id] do
        %ArticleWorkingCopy{scope_id: ^id, revision: ^revision} = default ->
          case Publishable.validate(default) do
            {:ok, :pass} -> {:cont, {:ok, [{articles[id], default} | acc]}}
            {:error, _reason} = error -> {:halt, error}
          end

        %ArticleWorkingCopy{scope_id: ^id, revision: actual} ->
          {:halt, {:error, {:default_revision_conflict, id, actual}}}

        _ ->
          {:halt, {:error, :invalid_queue_member_owner}}
      end
    end)
    |> case do
      {:ok, values} -> {:ok, Enum.reverse(values)}
      error -> error
    end
  end

  defp fork_batch(locked, queue, actor, command_id) do
    Enum.reduce_while(locked, {:ok, []}, fn {article, default}, {:ok, acc} ->
      with {:ok, snapshot} <- Snapshotter.freeze_locked(article, default, actor, command_id),
           {:ok, copy} <-
             Snapshotter.fork_snapshot_in_transaction(
               snapshot.id,
               %{article_id: article.id, scope_kind: :workspace, scope_id: queue.id},
               actor
             ) do
        entry = %{
          article_id: article.id,
          default_revision: default.revision,
          source_snapshot_id: snapshot.id,
          working_copy_id: copy.id
        }

        {:cont, {:ok, [entry | acc]}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end
end
