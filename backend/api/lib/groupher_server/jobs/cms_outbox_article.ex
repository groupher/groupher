defmodule GroupherServer.Jobs.CMSOutboxArticle do
  @moduledoc """
  Routes committed Article outbox wakeups to the CMS delivery workflow. The
  Oban job carries the durable event identifier; leasing, retries, and
  idempotent effect handling remain owned by CMS.

      Article command commits outbox event
          -> Oban wakeup with event_id
          -> CMS.deliver_outbox(:article, job)
          -> Article outbox workflow and downstream effects
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Article outbox job through the CMS outbox owner.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => 1}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:article, job)
end
