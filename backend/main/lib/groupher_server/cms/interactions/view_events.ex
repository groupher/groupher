defmodule GroupherServer.CMS.Interactions.ViewEvents do
  @moduledoc """
  Routes durable Article view-event recording, projection, and maintenance.

  View events are high-frequency observations rather than user-driven
  reactions, so they do not acquire the Article aggregate mutation lock.

      CMS.Interactions -> ViewEvents -> Record / Project / Maintenance
  """

  alias __MODULE__.{Maintenance, Project, Record}
  alias GroupherServer.Accounts.Model.User

  @doc """
  Records a durable Article view.

  ## Examples

      ViewEvents.record(article, viewer, event_id)

  """
  @spec record(struct(), User.t() | nil, Ecto.UUID.t() | nil) ::
          {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate record(article, viewer, event_id), to: Record

  @doc """
  Projects one durable view event idempotently.

  ## Examples

      ViewEvents.project(event_id)

  """
  @spec project(Ecto.UUID.t()) :: :ok | {:error, term()}
  defdelegate project(event_id), to: Project

  @doc """
  Records a failed projection attempt.

  ## Examples

      ViewEvents.record_failure(event_id, reason)

  """
  @spec record_failure(Ecto.UUID.t(), term()) :: :ok
  defdelegate record_failure(event_id, reason), to: Project

  @doc """
  Deletes processed events outside the retention window.

  ## Examples

      ViewEvents.delete_expired()

  """
  @spec delete_expired() :: {non_neg_integer(), nil}
  defdelegate delete_expired(), to: Maintenance

  @doc """
  Returns durable view-event operational metrics.

  ## Examples

      ViewEvents.metrics()

  """
  @spec metrics() :: map()
  defdelegate metrics(), to: Maintenance
end
