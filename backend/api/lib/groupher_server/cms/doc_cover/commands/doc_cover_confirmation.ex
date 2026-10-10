defmodule GroupherServer.CMS.DocCover.Commands.DocCoverConfirmation do
  @moduledoc """
  Encodes the final result of receipt-backed DocCover actions.

      DocCover Command
        -> DocCoverConfirmation
        -> CommandReceipt replay
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :doc_cover_add_card,
    operations: [
      :doc_cover_add_card,
      :doc_cover_remove_card,
      :doc_cover_pin_doc,
      :doc_cover_unpin_doc,
      :doc_cover_reorder_cards,
      :doc_cover_reorder_pinned_docs
    ],
    data_keys: ["command_id", "operation_result"],
    field_types: %{
      "command_id" => :string,
      "operation_result" => :json
    }

  @type t :: %__MODULE__{data: map()}
end
