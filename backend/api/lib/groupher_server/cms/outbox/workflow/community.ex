defmodule GroupherServer.CMS.Outbox.Workflow.Community do
  @moduledoc """
  Delivers Community and DocTree public-cache cleanup intents.

  Business position:

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> Community / DocTree cache effects
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{Analysis, CMS, ErrorCat}

  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Dashboard.PagiMode
  alias CMS.Outbox

  @doc """
  Delivers one Community or DocTree outbox event under the shared lease protocol.

  Busy leases snooze; transient delivery errors retry; after exhaustion Outbox
  records terminal failure and the job is acknowledged.
  """
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &cleanup/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:error,
       %ErrorCat.Error{
         namespace: {:cms},
         reason: :outbox_delivery_exhausted
       }} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp cleanup(event) do
    case event.event do
      "community.analysis_provision" -> provision_analysis(event.resource_id)
      _ -> purge_cache(event)
    end
  end

  defp provision_analysis(community_id) do
    case Integer.parse(to_string(community_id)) do
      {community_id, ""} ->
        with {:ok, community} <- CMS.FrontDesk.community(community_id, mode: :internal) do
          Analysis.web_provision_community_on_create(community)
        end

      _ ->
        {:error, CommunityErrorCat.invalid_outbox_resource()}
    end
  end

  defp purge_cache(event) do
    with {:ok, :pass} <- invalidate_dashboard_pagination(event),
         {:ok, type} <- invalidation_type(event.event),
         {:ok, tags} <- GroupherServer.PublicCache.scope_tags(type, event.data),
         {:ok, _} <- GroupherServer.PublicCache.cloudflare_purge(tags) do
      {:ok, :purged}
    end
  end

  defp invalidate_dashboard_pagination(%{
         event: "community.pagi_mode_changed",
         data: data
       }) do
    community = Map.get(data, "community") || Map.get(data, :community)

    case community do
      slug when is_binary(slug) ->
        with {:ok, _} <- PagiMode.invalidate(slug), do: {:ok, :pass}

      _ ->
        {:error, CommunityErrorCat.invalid_pagination_invalidation()}
    end
  end

  defp invalidate_dashboard_pagination(_event), do: {:ok, :pass}

  defp invalidation_type("community.presentation_changed") do
    {:ok, :community_presentation_changed}
  end

  defp invalidation_type("community.pagi_mode_changed") do
    {:ok, :pagination_config_changed}
  end

  defp invalidation_type("community.taxonomy_changed"), do: {:ok, :taxonomy_changed}
  defp invalidation_type("doc_tree.changed"), do: {:ok, :doc_tree_changed}
  defp invalidation_type(_event), do: {:error, CommunityErrorCat.unknown_outbox_event()}
end
