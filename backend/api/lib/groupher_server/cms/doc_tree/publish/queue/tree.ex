defmodule GroupherServer.CMS.DocTree.Publish.Queue.Tree do
  @moduledoc """
  Reconciles the persisted directory queue against an admitted target tree.

      locked public tree + stored Queue changes + target tree -> net rows and field authors

  The caller owns the public baseline, Gate, Lifecycle, Doc ownership, page
  dependencies, source events, Receipt, effects and rollback. This operation
  does not write the working tree or decide which changes should be queued.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, TargetTree, TreeCodec, TreeContributions, TreeOperations}
  alias CMS.Model.{Community, DocsPublishQueue, DocsQueueTreeChange, DocsQueueTreeContributor}

  @fields ~w(existence parent_node_id index title href doc_id marker badge hidden)a
  @field_names Map.new(@fields, &{Atom.to_string(&1), &1})

  @doc "Persists a complete admitted target and advances the Queue only when its plan changes."
  def reconcile(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        public_nodes,
        target_nodes,
        %User{id: user_id} = actor
      )
      when is_integer(revision) and revision >= 0 and is_list(public_nodes) and
             is_list(target_nodes) and is_integer(user_id) and user_id > 0 do
    reconcile_locked(community, queue, revision, public_nodes, target_nodes, actor, true)
  end

  def reconcile(_, _, _, _, _, _), do: {:error, :invalid_tree_input}

  @doc "Reconciles dependencies after content has already advanced the same transaction's Queue."
  def reconcile_after_content(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        public_nodes,
        target_nodes,
        %User{id: user_id} = actor
      )
      when is_integer(revision) and revision > 0 and is_list(public_nodes) and
             is_list(target_nodes) and is_integer(user_id) and user_id > 0 do
    reconcile_locked(community, queue, revision, public_nodes, target_nodes, actor, false)
  end

  def reconcile_after_content(_, _, _, _, _, _), do: {:error, :invalid_tree_input}

  defp reconcile_locked(community, queue, revision, public_nodes, target_nodes, actor, advance?) do
    with {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, actor.id),
         {:ok, public} <- TargetTree.build(public_nodes, []),
         {:ok, target} <- TargetTree.build(target_nodes, []),
         rows <- load_changes(queue.id),
         {:ok, decoded} <- TreeCodec.decode_changes(rows),
         {:ok, previous} <- TargetTree.build(public, decoded),
         {:ok, desired} <- desired_changes(public, target),
         {:ok, _plan} <- TreeOperations.plan(public, desired),
         {:ok, authors} <- load_authors(queue.id),
         {:ok, writes} <- prepare_writes(public, previous, target, rows, authors, actor.id),
         {:ok, :pass} <- persist_writes(community, queue, writes, target),
         {:ok, updated} <- advance(community, queue, revision, writes, advance?) do
      {:ok, %{queue: updated, changed_node_ids: Enum.map(writes, & &1.id), target: target}}
    else
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  defp load_changes(queue_id) do
    Repo.all(
      from(row in DocsQueueTreeChange,
        where: row.queue_id == ^queue_id,
        order_by: row.node_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp load_authors(queue_id) do
    Repo.all(
      from(row in DocsQueueTreeContributor,
        where: row.queue_id == ^queue_id,
        order_by: [row.node_id, row.field_name],
        lock: "FOR UPDATE"
      )
    )
    |> Enum.reduce_while({:ok, %{}}, fn row, {:ok, by_node} ->
      case Map.fetch(@field_names, row.field_name) do
        {:ok, field} ->
          {:cont,
           {:ok,
            Map.update(
              by_node,
              row.node_id,
              %{field => row.user_id},
              &Map.put(&1, field, row.user_id)
            )}}

        :error ->
          {:halt, {:error, :invalid_tree_contributions}}
      end
    end)
  end

  defp desired_changes(public, target) do
    before = Map.new(public, &{&1.node_id, &1})
    after_nodes = Map.new(target, &{&1.node_id, &1})
    ids = (Map.keys(before) ++ Map.keys(after_nodes)) |> Enum.uniq() |> Enum.sort()

    {:ok,
     Enum.flat_map(ids, fn id ->
       case {before[id], after_nodes[id]} do
         {value, value} -> []
         {_, nil} -> [%{node_id: id, change_type: :delete, target: nil}]
         {_, value} -> [%{node_id: id, change_type: :upsert, target: Map.delete(value, :node_id)}]
       end
     end)}
  end

  defp prepare_writes(public, previous, target, rows, authors, actor_id) do
    base = Map.new(public, &{&1.node_id, &1})
    old = Map.new(previous, &{&1.node_id, &1})
    new = Map.new(target, &{&1.node_id, &1})
    rows = Map.new(rows, &{&1.node_id, &1})

    ids =
      (Map.keys(base) ++ Map.keys(old) ++ Map.keys(new) ++ Map.keys(rows))
      |> Enum.uniq()
      |> Enum.sort()

    Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, writes} ->
      with {:ok, next_authors} <-
             TreeContributions.reconcile(
               base[id],
               old[id],
               new[id],
               Map.get(authors, id, %{}),
               actor_id
             ) do
        if old[id] == new[id] do
          {:cont, {:ok, writes}}
        else
          item = %{
            id: id,
            public: base[id],
            target: new[id],
            row: rows[id],
            authors: next_authors
          }

          {:cont, {:ok, [item | writes]}}
        end
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, writes} -> {:ok, Enum.reverse(writes)}
      error -> error
    end
  end

  defp persist_writes(_community, _queue, [], _target), do: {:ok, :pass}

  defp persist_writes(community, queue, writes, target) do
    with {:ok, encoded} <- TreeCodec.encode(target) do
      encoded_by_id = Map.new(encoded["nodes"], &{&1["node_id"], Map.delete(&1, "node_id")})

      Enum.reduce_while(writes, {:ok, :pass}, fn item, _ ->
        case persist_one(community, queue, item, encoded_by_id[item.id]) do
          {:ok, :pass} -> {:cont, {:ok, :pass}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end

  defp persist_one(_community, _queue, %{public: value, target: value, row: nil}, _encoded) do
    {:ok, :pass}
  end

  defp persist_one(_community, _queue, %{public: value, target: value, row: row}, _encoded) do
    case Repo.delete(row) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp persist_one(community, queue, item, encoded) do
    attrs = %{
      queue_id: queue.id,
      community_id: community.id,
      node_id: item.id,
      change_type: if(is_nil(item.target), do: :delete, else: :upsert),
      target: encoded,
      source_event_id: nil
    }

    with {:ok, _} <-
           (item.row || %DocsQueueTreeChange{})
           |> DocsQueueTreeChange.changeset(attrs)
           |> Repo.insert_or_update() do
      Repo.delete_all(
        from(c in DocsQueueTreeContributor,
          where: c.queue_id == ^queue.id and c.node_id == ^item.id
        )
      )

      values =
        Enum.map(item.authors, fn {field, user_id} ->
          %{
            queue_id: queue.id,
            node_id: item.id,
            field_name: Atom.to_string(field),
            user_id: user_id
          }
        end)

      Repo.insert_all(DocsQueueTreeContributor, values)
      {:ok, :pass}
    end
  end

  defp advance(_community, queue, _revision, _writes, false), do: {:ok, queue}
  defp advance(_community, queue, _revision, [], true), do: {:ok, queue}

  defp advance(community, queue, revision, _writes, true) do
    Queue.advance(community, queue, %{queue_revision: revision}, [:queue_revision])
  end
end
