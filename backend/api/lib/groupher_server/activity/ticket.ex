defmodule GroupherServer.Activity.Ticket do
  @moduledoc """
  Owns the append-only Activity contract for Ticket work and source changes.

      Ticket command -> Ticket Activity contract -> TicketLog
                                                `-> Activity surfaces
  """

  use GroupherServer.Activity.ArtimentEvent,
    thread: :ticket,
    schema: GroupherServer.Activity.Model.TicketLog,
    stream_field: :article_id

  alias GroupherServer.Activity.Event

  @contracts %{
    created: Event.contract([], [], []),
    source_linked: Event.contract([], [:ticket_source_id, :source_type, :source_id], []),
    source_unlinked: Event.contract([], [:ticket_source_id, :source_type, :source_id], []),
    work_status_changed: Event.contract([:from_status, :to_status], [], []),
    draft_saved: Event.contract([:changed_fields], [:draft_version], []),
    moved_to_draft:
      Event.contract(
        [],
        [
          :lifecycle_version,
          :reason,
          :source_type,
          :visibility_cause,
          :source_id,
          :from_publication_state,
          :to_publication_state
        ],
        []
      ),
    published:
      Event.contract(
        [:revision_id],
        [:lifecycle_version, :reason, :from_publication_state, :to_publication_state],
        []
      ),
    public_update_published: Event.contract([:update_id], [], []),
    public_update_superseded: Event.contract([:update_id, :supersedes_id], [], [])
  }

  @doc """
  Returns Ticket Activity's closed command and payload contract.

  ## Examples

      Map.has_key?(GroupherServer.Activity.Ticket.contracts(), :created)
      #=> true
  """
  def contracts, do: Event.classify_contracts(@contracts)
end
