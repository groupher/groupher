defmodule GroupherServer.Jobs.CMSOutboxTicket do
  @moduledoc """
  Registers Ticket Outbox delivery with Oban's CMS Outbox queue.

      committed Ticket Outbox event
        -> Oban job carrying event_id
        -> Ticket workflow delivery
  """

  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Hands one scheduled Ticket Outbox event to the shared CMS delivery boundary.

  ## Examples

      CMSOutboxTicket.new(%{event_id: event_id})
      |> Oban.insert()
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:ticket, job)
end
