defmodule GroupherServer.Jobs.CMSArtimentReview do
  @moduledoc """
  Oban wakeup for one CMS-owned review request Effect.

  Business position:

      Oban review queue
        -> CMS outbox delivery
          -> ReviewBot processes the current request
  """

  use Oban.Worker,
    queue: :cms_review,
    max_attempts: 3,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers the outbox event carried by the queued worker job.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:artiment_review, job)
end
