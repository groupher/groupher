defmodule GroupherServer.Activity.Model.TicketLog do
  @moduledoc """
  Stores append-only Activity facts for Ticket streams.

      Ticket command -> Ticket Activity contract -> activity.ticket_logs
  """

  use GroupherServer.Activity.Model.Base,
    table: "ticket_logs",
    stream_field: :article_id,
    actions: [
      :created,
      :source_linked,
      :source_unlinked,
      :work_status_changed,
      :draft_saved,
      :published,
      :moved_to_draft,
      :public_update_published,
      :public_update_superseded
    ]
end
