defmodule GroupherServer.Jobs.CMSOutboxPress do
  @moduledoc """
  Oban entrypoint for Press outbox delivery.

      CMS Outbox -> CMSOutboxPress -> CMS root Facade -> Press workflow
  """

  use Oban.Worker,
    queue: :press,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Press outbox event through the CMS root Facade.

  ## Examples

      CMSOutboxPress.perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:press, job)
end
