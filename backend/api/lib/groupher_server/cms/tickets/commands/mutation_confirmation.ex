defmodule GroupherServer.CMS.Tickets.Commands.MutationConfirmation do
  @moduledoc """
  Defines the typed result anchor stored for receipt-backed Ticket commands.

      Ticket command result
        -> validated receipt payload
        -> stable replay and recovery response
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :ticket_create_from_post,
    operations: [
      :ticket_add_case_member,
      :ticket_add_case_worker,
      :ticket_add_update,
      :ticket_create_case,
      :ticket_create_from_post,
      :ticket_create_worker,
      :ticket_ensure_draft,
      :ticket_link_source,
      :ticket_move,
      :ticket_move_to_draft,
      :ticket_publish,
      :ticket_remove_case_member,
      :ticket_save_draft,
      :ticket_set_assignees,
      :ticket_set_facets,
      :ticket_set_tags,
      :ticket_transition,
      :ticket_unlink_source,
      :ticket_update
    ],
    data_keys: ["ticket_id", "community_id", "action"],
    field_types: %{
      "ticket_id" => :string,
      "community_id" => :integer,
      "action" => :string
    }
end
