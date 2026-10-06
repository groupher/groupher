defmodule GroupherServer.CMS.Outbox.Workers.Community.Cleanup do
  @moduledoc """
  Delivers Community and DocTree public-cache cleanup intents.

  Business position:

      committed Community/DocTree outbox event
        -> Community.Cleanup worker
        -> public-cache purge
  """

  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  alias GroupherServer.CMS.Outbox
  alias GroupherServer.PublicCache.{Cloudflare, Scope}

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &cleanup/1) do
      {:ok, _value} ->
        :ok

      {:busy, seconds} ->
        {:snooze, seconds}

      {:error, _reason} when job.attempt >= job.max_attempts ->
        _ = Outbox.mark_dead(event_id)
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp cleanup(event) do
    with {:ok, type} <- invalidation_type(event.event),
         {:ok, tags} <- Scope.tags(type, event.data),
         :ok <- Cloudflare.purge(tags) do
      {:ok, :purged}
    end
  end

  defp invalidation_type("community.presentation_changed") do
    {:ok, :community_presentation_changed}
  end

  defp invalidation_type("community.taxonomy_changed"), do: {:ok, :taxonomy_changed}
  defp invalidation_type("doc_tree.changed"), do: {:ok, :doc_tree_changed}
  defp invalidation_type(_event), do: {:error, :unknown_community_outbox_event}
end
