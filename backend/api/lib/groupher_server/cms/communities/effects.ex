defmodule GroupherServer.CMS.Communities.Effects do
  @moduledoc """
  Owns Community activity and other in-transaction effects.

      Community Command / Lifecycle
        -> Communities.Effects
        -> Activity / context-specific effect owner
  """

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Model.{Community, CommunityLifecycle}

  @doc "Records one Community activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Records durable analytics provisioning for a newly created Community."
  @spec enqueue_analysis_provision(Community.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_analysis_provision(%Community{} = community, command_id) do
    CMS.Outbox.send(%{
      event: "community.analysis_provision",
      worker: GroupherServer.Jobs.CMSOutboxCommunity,
      resource_type: "community",
      resource_id: community.id,
      identity: {:command, command_id},
      effect_key: "analysis_provision",
      data: %{community_id: community.id}
    })
  end

  @doc "Reconciles source-linked Tickets and public cache after Community readability changes."
  def lifecycle_changed(
        %CommunityLifecycle{} = old_lifecycle,
        %CommunityLifecycle{} = new_lifecycle,
        operation_ref
      )
      when is_binary(operation_ref) do
    before_public? = old_lifecycle.state in [:active, :read_only]
    after_public? = new_lifecycle.state in [:active, :read_only]

    if before_public? == after_public? do
      {:ok, :pass}
    else
      with {:ok, community} <- load_community(new_lifecycle.community_id),
           {:ok, :pass} <-
             CMS.Tickets.PostVisibility.reconcile_community_in_transaction(
               community,
               nil,
               operation_ref
             ),
           {:ok, _event} <- enqueue_public_cache_invalidation(community, operation_ref) do
        {:ok, :pass}
      end
    end
  end

  def lifecycle_changed(_before, _after, _operation_ref), do: {:ok, :pass}

  defp enqueue_public_cache_invalidation(%Community{} = community, operation_ref) do
    CMS.Outbox.send(%{
      event: "community.presentation_changed",
      worker: GroupherServer.Jobs.CMSOutboxCommunity,
      resource_type: "community",
      resource_id: community.id,
      identity: {:workflow, "community_lifecycle:#{community.id}:#{operation_ref}"},
      effect_key: "public_visibility_changed",
      data: %{community: community.slug}
    })
  end

  defp load_community(community_id) do
    case Repo.get(Community, community_id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, CMS.Communities.ErrorCat.lifecycle_not_found()}
    end
  end
end
