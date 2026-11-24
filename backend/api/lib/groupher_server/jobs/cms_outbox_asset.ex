defmodule GroupherServer.Jobs.CMSOutboxAsset do
  @moduledoc """
  Routes committed Asset outbox wakeups to the CMS delivery workflow. The
  durable event identifier is the worker input; event leasing and retry-safe
  provider effects remain owned by CMS.

      Asset command commits outbox event
          -> Oban wakeup with event_id
          -> CMS.deliver_outbox(:asset, job)
          -> Asset outbox workflow and provider effects
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one Asset outbox job through the CMS outbox owner.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => 1}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:asset, job)
end
