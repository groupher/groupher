defmodule GroupherServer.CMS.Outbox.Workflow.ArticleCoAuthorRequest do
  @moduledoc """
  Delivers durable Article co-author request notices and invalidates recipient mailboxes.

      Oban job -> CMS -> ArticleCoAuthorRequest workflow -> Messaging -> mailbox cache
  """

  alias GroupherServer.{Accounts, CMS, ErrorCat, Messaging}
  alias CMS.ErrorCat, as: CMSErrorCat
  alias CMS.Outbox

  @doc "Executes one Article co-author request notice under Outbox delivery fencing."
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    case Outbox.execute(event_id, &Messaging.notify(:article_co_author_request, &1),
           on_error: if(job.attempt >= job.max_attempts, do: :fail, else: :classify)
         ) do
      {:ok, {_notice, users}} ->
        _ = Accounts.mailbox_invalidate_users(users)
        {:ok, :pass}

      {:ok, _result} ->
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

  def perform(_), do: {:error, CMSErrorCat.invalid_body("invalid Article co-author outbox event")}
end
