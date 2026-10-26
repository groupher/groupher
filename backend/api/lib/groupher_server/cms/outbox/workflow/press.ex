defmodule GroupherServer.CMS.Outbox.Workflow.Press do
  @moduledoc """
  Delivers durable Press cache-invalidation intents after config commits.

      Oban outbox job
        -> Outbox.execute lease + fencing
        -> canonical Community reload
        -> authenticated Press invalidation endpoint
        -> complete / retry / snooze / terminal failure
  """

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Model.Community
  alias CMS.Outbox

  @doc """
  Delivers one versioned Press outbox event under the shared lease protocol.

  Busy leases snooze; transient delivery errors retry; after exhaustion Outbox
  records terminal failure and the job is acknowledged.
  """
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &invalidate/1,
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

  defp invalidate(%{event: "press.cache_invalidation", contract_version: 1} = event) do
    case Integer.parse(event.resource_id) do
      {community_id, ""} ->
        case Repo.get(Community, community_id) do
          %Community{} = community -> CMS.Press.invalidate(community)
          nil -> {:ok, :pass}
        end

      _ ->
        {:error, CMS.ErrorCat.invalid_press_community_id()}
    end
  end

  defp invalidate(_event), do: {:error, CMS.ErrorCat.unknown_press_outbox_event()}
end
