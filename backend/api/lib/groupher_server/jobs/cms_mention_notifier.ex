defmodule GroupherServer.Jobs.CMSMentionNotifier do
  @moduledoc """
  Delivers User notifications for one immutable Mention set.

      Outbox producer -> event ID -> source/set validation -> notification
  """

  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers one notification event through the CMS Outbox workflow.

  ## Examples

      perform(%Oban.Job{args: %{"event_id" => event_id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:mention_notification, job)
end
