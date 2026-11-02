defmodule GroupherServer.CMS.Tickets.Lifecycle do
  @moduledoc """
  Owns Ticket work transitions, blockers, optimistic versions and work timestamps.

      Authorized Command -> Ticket Lifecycle -> Ticket State persistence
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{TicketState, TicketWorker}
  alias CMS.Tickets.ErrorCat

  @doc false
  def validate_transition(%TicketState{type: :case, status: from}, to) do
    if {from, to} in [{:open, :resolved}, {:resolved, :open}] do
      {:ok, :pass}
    else
      {:error, ErrorCat.invalid_transition()}
    end
  end

  @doc false
  def validate_transition(%TicketState{type: type, status: from} = state, to)
      when type in [:user, :worker] do
    valid = {from, to} in [{:todo, :wip}, {:wip, :done}, {:done, :wip}]

    cond do
      not valid ->
        {:error, ErrorCat.invalid_transition()}

      type == :user and to == :wip and not has_workers?(state.article_id) ->
        {:error, ErrorCat.worker_required()}

      type == :user and to == :done and not all_workers_done?(state.article_id) ->
        {:error, ErrorCat.workers_incomplete()}

      type == :worker and parent_done?(state.article_id) and to != :done ->
        {:error, ErrorCat.parent_ticket_done()}

      true ->
        {:ok, :pass}
    end
  end

  @doc false
  def validate_transition(_state, _to), do: {:error, ErrorCat.invalid_transition()}

  defp has_workers?(parent_id) do
    Repo.exists?(from(worker in TicketWorker, where: worker.parent_ticket_id == ^parent_id))
  end

  defp all_workers_done?(parent_id) do
    count =
      Repo.aggregate(
        from(worker in TicketWorker, where: worker.parent_ticket_id == ^parent_id),
        :count
      )

    count > 0 and
      Repo.aggregate(
        from(worker in TicketWorker,
          join: state in TicketState,
          on: state.article_id == worker.worker_ticket_id,
          where: worker.parent_ticket_id == ^parent_id and state.status != :done
        ),
        :count
      ) == 0
  end

  defp parent_done?(worker_id) do
    Repo.exists?(
      from(worker in TicketWorker,
        join: state in TicketState,
        on: state.article_id == worker.parent_ticket_id,
        where: worker.worker_ticket_id == ^worker_id and state.status == :done
      )
    )
  end

  @doc false
  def update_status(state, status) do
    now = DateTime.utc_now(:second)

    started_at =
      if status in [:wip, :open] and is_nil(state.started_at), do: now, else: state.started_at

    completed_at =
      if status in [:done, :resolved], do: state.completed_at || now, else: nil

    state
    |> TicketState.changeset(%{
      status: status,
      started_at: started_at,
      completed_at: completed_at,
      workflow_version: state.workflow_version + 1
    })
    |> Repo.update()
  end

  @doc false
  def validate_same_or_transition(%TicketState{status: status}, status), do: {:ok, :pass}
  @doc false
  def validate_same_or_transition(state, status), do: validate_transition(state, status)

  @doc false
  def update_position(state, status, rank) do
    now = DateTime.utc_now(:second)

    started_at =
      if status in [:wip, :open] and is_nil(state.started_at), do: now, else: state.started_at

    completed_at = if status in [:done, :resolved], do: state.completed_at || now, else: nil

    state
    |> TicketState.changeset(%{
      status: status,
      rank: rank,
      started_at: started_at,
      completed_at: completed_at,
      workflow_version: state.workflow_version + 1
    })
    |> Repo.update()
  end

  @doc false
  def increment_version(state) do
    state
    |> TicketState.changeset(%{workflow_version: state.workflow_version + 1})
    |> Repo.update()
  end

  @doc false
  def ensure_version(%TicketState{workflow_version: version}, version), do: {:ok, :pass}
  @doc false
  def ensure_version(_state, _version), do: {:error, ErrorCat.version_conflict()}
end
