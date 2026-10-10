defmodule GroupherServer.CMS.Dashboard.Effects do
  @moduledoc """
  Owns dashboard presentation effects after the Command has admitted a write.

      Dashboard.Command
        -> Gate + transaction
        -> Dashboard.Persist / Communities.Persist
        -> Dashboard.Effects
        -> CMS.Outbox

  This module is intentionally not a persistence module. It can only be
  called by a concrete dashboard or Community Command while the caller-owned
  transaction is open.
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @doc """
  Enqueues the public-presentation cleanup using the caller's command identity.

  The event is inserted into the current transaction; this function never
  creates a second identity or opens a transaction.

  ## Examples

      Dashboard.Effects.enqueue_presentation_changed(community, command_id)
      #=> {:ok, %CMS.Outbox.Event{}} | {:error, reason}
  """
  @spec enqueue_presentation_changed(Community.t(), Ecto.UUID.t() | {:workflow, String.t()}) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_presentation_changed(%Community{} = community, identity) do
    identity_attrs =
      case identity do
        {:workflow, workflow_ref} -> %{identity: {:workflow, workflow_ref}}
        command_id -> %{command_id: command_id}
      end

    Map.merge(identity_attrs, %{
      event: "community.presentation_changed",
      worker: CMS.Outbox.Workers.Community.Cleanup,
      resource_type: "community",
      resource_id: community.id,
      data: %{community: community.slug, community_id: community.id}
    })
    |> CMS.Outbox.send()
  end
end
