defmodule GroupherServer.Messaging.Notify do
  @moduledoc """
  Dispatches durable notification events to their domain-owned delivery paths.

  Community Admin request events are projected into Notice and Inbox facts by
  the request delivery owner. Other event families retain the current
  acknowledgement boundary until their producer migrations are complete.

  Business position:

      Domain event
        -> Messaging facade
        -> Notify
        -> inbox / notification store
  """

  alias GroupherServer.CMS.Outbox.Event
  alias GroupherServer.Messaging.Notices.RequestDelivery

  @doc """
  Accepts a notification event at the stable dispatch boundary.

  ## Examples

      Messaging.Notify.dispatch(:comment_created, %{comment_id: comment.id})
  """
  @spec dispatch(atom(), map()) :: {:ok, term()} | {:error, term()}
  def dispatch(:community_admin_request, %Event{} = event) do
    RequestDelivery.deliver(event)
  end

  def dispatch(:article_co_author_request, %Event{} = event) do
    RequestDelivery.deliver(event)
  end

  def dispatch(event, payload) when is_atom(event) and is_map(payload) do
    _ = {event, payload}
    {:ok, :pass}
  end

  def dispatch(_, _), do: {:error, GroupherServer.CMS.error_cat_invalid_notify_payload()}
end
