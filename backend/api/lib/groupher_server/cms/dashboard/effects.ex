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
  alias CMS.Outbox.DedupeKey

  @doc """
  Enqueues public-presentation cleanup with the caller's operation identity.

  The event is inserted into the current transaction; this function never
  creates a second identity or opens a transaction.

  ## Examples

      Dashboard.Effects.enqueue_presentation_changed(community, operation_ref)
      #=> {:ok, %CMS.Outbox.Event{}} | {:error, reason}
  """
  @spec enqueue_presentation_changed(Community.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_presentation_changed(%Community{} = community, operation_ref) do
    %{
      operation_ref: operation_ref,
      dedupe_key: DedupeKey.encode([community.id]),
      event: "community.presentation_changed",
      worker: GroupherServer.Jobs.CMSOutboxCommunity,
      resource_type: "community",
      resource_id: community.id,
      data: %{community: community.slug, community_id: community.id}
    }
    |> CMS.Outbox.send()
  end

  @doc "Enqueues cache invalidation for the community-wide list preference."
  @spec enqueue_pagi_mode_changed(Community.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_pagi_mode_changed(%Community{} = community, operation_ref) do
    %{
      operation_ref: operation_ref,
      dedupe_key: DedupeKey.encode([community.id]),
      event: "community.pagi_mode_changed",
      worker: GroupherServer.Jobs.CMSOutboxCommunity,
      resource_type: "community",
      resource_id: community.id,
      data: %{
        community: community.slug,
        community_id: community.id
      }
    }
    |> CMS.Outbox.send()
  end
end
