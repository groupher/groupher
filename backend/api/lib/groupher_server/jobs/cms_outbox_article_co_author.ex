defmodule GroupherServer.Jobs.CMSOutboxArticleCoAuthor do
  @moduledoc """
  Delivers durable Article co-author request notices through Messaging.

      Outbox event -> Messaging.notify -> Dedup + Notice + mailbox projection
  """
  use Oban.Worker,
    queue: :cms_outbox,
    max_attempts: 8,
    unique: [period: 86_400, keys: [:event_id], states: :incomplete]

  @impl Oban.Worker
  @doc """
  Delivers a committed Article request Notice intent and invalidates mailbox projections after success.

  Outbox errors are classified for retry until the worker's final attempt; contention and transient
  outcomes snooze the job. An exhausted delivery is acknowledged because retry policy has completed.

  ## Examples

  A command-created Outbox event can be delivered directly in the focused worker test:

      assert {:ok, :pass} =
               CMSOutboxArticleCoAuthor.perform(%Oban.Job{args: %{"event_id" => event.id}})
  """
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:article_co_author_request, job)
end
