defmodule GroupherServer.CMS.DocTree.Publish.Queue.Store do
  @moduledoc """
  Persists Queue initialization and version changes inside a caller-owned transaction.

      Docs command -> Gate -> site lock -> Queue row -> checked version update

  This internal store does not authorize actors, own a transaction or decide
  whether a business operation changes a version. Its caller does all three,
  and must aggregate one command's changes before advancing each version once.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.DocTree.Publish.SiteLock
  alias CMS.Model.{Community, DocsPublishQueue}

  @versions [
    :tree_lock_version,
    :queue_revision,
    :public_presentation_revision,
    :approval_policy_revision
  ]
  @max_bigint 9_223_372_036_854_775_807
  @content_versions @versions -- [:approval_policy_revision]

  @doc "Reads the Queue or its unpersisted empty state without initializing a row."
  def read(%Community{id: id}) when is_integer(id) and id > 0 do
    case Repo.get_by(DocsPublishQueue, community_id: id) do
      nil -> {:ok, %DocsPublishQueue{community_id: id}}
      queue -> {:ok, queue}
    end
  end

  def read(_community), do: {:error, :invalid_docs_site}

  @doc "Initializes and locks the site's single Queue inside the caller transaction."
  def lock_or_create(%Community{id: id} = community) when is_integer(id) and id > 0 do
    with {:ok, :acquired} <- SiteLock.acquire(community) do
      now = DateTime.utc_now(:second)

      Repo.insert_all(
        DocsPublishQueue,
        [%{id: Ecto.UUID.generate(), community_id: id, inserted_at: now, updated_at: now}],
        on_conflict: :nothing,
        conflict_target: [:community_id]
      )

      case locked_queue(id) do
        %DocsPublishQueue{} = queue -> {:ok, queue}
        nil -> {:error, :queue_initialization_failed}
      end
    end
  end

  def lock_or_create(_community), do: {:error, :invalid_docs_site}

  @doc "Checks expected counters and advances each requested counter once on a locked Queue."
  def advance(%Community{id: id} = community, %DocsPublishQueue{id: queue_id}, expected, changes)
      when is_integer(id) and id > 0 and is_binary(queue_id) and is_map(expected) and
             is_list(changes) and changes == [] do
    advance_locked(community, id, queue_id, expected, changes, nil)
  end

  def advance(%Community{}, %DocsPublishQueue{}, expected, changes)
      when is_map(expected) and is_list(changes) and changes != [] do
    {:error, :operation_ref_required}
  end

  def advance(_community, _queue, _expected, _changes), do: {:error, :invalid_queue_versions}

  def advance(
        %Community{id: id} = community,
        %DocsPublishQueue{id: queue_id},
        expected,
        changes,
        operation_ref
      )
      when is_integer(id) and id > 0 and is_binary(queue_id) and is_map(expected) and
             is_list(changes) and is_binary(operation_ref) do
    case Ecto.UUID.cast(operation_ref) do
      {:ok, operation_ref} ->
        advance_locked(community, id, queue_id, expected, changes, operation_ref)

      :error ->
        {:error, :invalid_operation_ref}
    end
  end

  def advance(_community, _queue, _expected, _changes, _operation_ref) do
    {:error, :invalid_queue_versions}
  end

  defp advance_locked(community, id, queue_id, expected, changes, operation_ref) do
    with {:ok, :pass} <- validate_versions(expected, changes),
         {:ok, :acquired} <- SiteLock.acquire(community),
         %DocsPublishQueue{id: ^queue_id} = queue <- locked_queue(id),
         {:ok, :pass} <- check_expected(queue, expected),
         {:ok, :pass} <- check_overflow(queue, changes) do
      case changes do
        [] -> {:ok, queue}
        _ -> update_versions(queue, changes, operation_ref)
      end
    else
      nil -> {:error, :queue_not_found}
      %DocsPublishQueue{} -> {:error, :queue_not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc "Updates approval settings and their policy revision together when they change."
  def set_policy(
        %Community{id: id} = community,
        %DocsPublishQueue{id: queue_id},
        expected_revision,
        approval_required,
        allow_self_approval,
        operation_ref
      )
      when is_integer(id) and id > 0 and is_binary(queue_id) and
             is_integer(expected_revision) and expected_revision >= 0 and
             is_binary(operation_ref) and
             is_boolean(approval_required) and is_boolean(allow_self_approval) do
    with {:ok, :acquired} <- SiteLock.acquire(community),
         %DocsPublishQueue{id: ^queue_id} = queue <- locked_queue(id),
         {:ok, :pass} <- check_expected(queue, %{approval_policy_revision: expected_revision}) do
      if queue.approval_required == approval_required and
           queue.allow_self_approval == allow_self_approval do
        {:ok, %{queue: queue, changed?: false}}
      else
        with {:ok, :pass} <- check_overflow(queue, [:approval_policy_revision]),
             {:ok, updated} <-
               queue
               |> Ecto.Changeset.change(%{
                 approval_required: approval_required,
                 allow_self_approval: allow_self_approval,
                 approval_policy_revision: queue.approval_policy_revision + 1
               })
               |> Repo.update() do
          with {:ok, _} <-
                 CMS.DocTree.Publication.Notifications.changed(queue, updated, operation_ref) do
            {:ok, %{queue: updated, changed?: true}}
          end
        end
      end
    else
      nil -> {:error, :queue_not_found}
      %DocsPublishQueue{} -> {:error, :queue_not_found}
      {:error, _reason} = error -> error
    end
  end

  def set_policy(_community, _queue, _revision, _required, _self, _operation_ref) do
    {:error, :invalid_queue_policy}
  end

  defp locked_queue(community_id) do
    Repo.one(
      from(queue in DocsPublishQueue,
        where: queue.community_id == ^community_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp validate_versions(expected, changes) do
    keys = Map.keys(expected)

    if keys != [] and Enum.all?(keys, &(&1 in @versions)) and
         Enum.all?(expected, fn {_key, value} -> is_integer(value) and value >= 0 end) and
         Enum.all?(changes, &(&1 in keys and &1 in @content_versions)) and
         length(changes) == length(Enum.uniq(changes)) do
      {:ok, :pass}
    else
      {:error, :invalid_queue_versions}
    end
  end

  defp check_expected(queue, expected) do
    Enum.reduce_while(@versions, {:ok, :pass}, fn field, result ->
      case Map.fetch(expected, field) do
        {:ok, value} ->
          actual = Map.fetch!(queue, field)

          if value == actual do
            {:cont, result}
          else
            {:halt, {:error, {:queue_version_conflict, field, actual}}}
          end

        _ ->
          {:cont, result}
      end
    end)
  end

  defp check_overflow(queue, changes) do
    if Enum.any?(changes, &(Map.fetch!(queue, &1) == @max_bigint)) do
      {:error, :queue_version_exhausted}
    else
      {:ok, :pass}
    end
  end

  defp update_versions(queue, changes, operation_ref) do
    attrs = Map.new(changes, fn field -> {field, Map.fetch!(queue, field) + 1} end)

    with {:ok, updated} <- queue |> Ecto.Changeset.change(attrs) |> Repo.update(),
         {:ok, _} <- notify_change(queue, updated, changes, operation_ref) do
      {:ok, updated}
    end
  end

  defp notify_change(old, updated, changes, operation_ref) do
    if :public_presentation_revision in changes do
      {:ok, :unchanged}
    else
      CMS.DocTree.Publication.Notifications.changed(old, updated, operation_ref)
    end
  end
end
