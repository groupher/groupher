defmodule GroupherServer.CMS.Outbox.Workflow.Ticket do
  @moduledoc """
  Delivers Ticket Outbox events under a shared lease, then purges cache tags or sends notifications.

      Ticket Outbox event
        -> Oban worker and lease
        -> cache purge or participant notification
  """

  alias GroupherServer.{CMS, ErrorCat}

  @doc "Delivers one Ticket invalidation through the shared Outbox lease."
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case CMS.Outbox.execute(event_id, &deliver/1,
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:snooze, seconds} ->
        {:snooze, seconds}

      {:error, %ErrorCat.Error{namespace: {:cms}, reason: :outbox_delivery_exhausted}} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp deliver(%{event: "ticket.cache_invalidation", data: %{"cache_tags" => tags}}) do
    with {:ok, tags} <- GroupherServer.PublicCache.validate_tags(tags),
         {:ok, result} <- GroupherServer.PublicCache.purge_tags(tags) do
      {:ok, result}
    end
  end

  defp deliver(%{event: "ticket.notification"} = event) do
    CMS.Tickets.Effects.Notifications.deliver(event)
  end

  defp deliver(_event), do: {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
end
