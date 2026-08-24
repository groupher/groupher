defmodule GroupherServer.Activity.Community do
  @moduledoc """
  Owns Community lifecycle Activity actions and projections.

      Community command -> Community Activity contract -> CommunityLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.CommunityLog
  alias GroupherServer.CMS.Model.Community

  @contracts %{
    blocker_created: Event.contract([], [:kind, :ref, :reason], [:community_log]),
    blocker_released: Event.contract([], [:kind, :ref, :reason], [:community_log]),
    blocker_terminated: Event.contract([], [:kind, :ref, :reason], [:community_log]),
    setup_failed: Event.contract([], [:stage, :reason_code, :state], [:community_log]),
    setup_retried: Event.contract([], [:stage, :state], [:community_log]),
    activated: Event.contract([], [:state], [:community_log]),
    destroy_scheduled: Event.contract([], [:state, :scheduled_at], [:community_log]),
    destroy_cancelled: Event.contract([], [:state], [:community_log]),
    destroyed: Event.contract([], [:state], [:community_log]),
    lifecycle_reconciled: Event.contract([], [:state, :reason], [:community_log])
  }

  def contracts, do: Event.classify_contracts(@contracts)
  def schema, do: CommunityLog
  def stream_field, do: :community_ref
  def resource_type, do: :community
  def log(resource, action, opts), do: Event.log(__MODULE__, resource, action, opts)
  def project(log, surface), do: Event.project(__MODULE__, log, surface)
  def surface_actions(surface), do: Event.surface_actions(__MODULE__, surface)

  def describe(%Community{} = community, _action, _opts) do
    {:ok, descriptor(community.id, community.slug, Event.snapshot(community, [:slug, :title]))}
  end

  def describe(%{activity_type: :community, community_id: id} = resource, _action, _opts) do
    ref = Map.get(resource, :ref, id)
    {:ok, descriptor(id, ref, Event.snapshot(resource, [:slug, :title]))}
  end

  def describe(_, _, _), do: {:error, Event.error("invalid Activity Community resource")}

  defp descriptor(id, ref, snapshot) do
    %{
      community_id: id,
      community_ref: Event.stringify(ref),
      stream_snapshot: snapshot,
      subject_type: "community",
      subject_ref: Event.stringify(ref),
      subject_snapshot: snapshot,
      target_type: nil,
      target_ref: nil,
      target_snapshot: %{}
    }
  end
end
