defmodule GroupherServer.CMS.Articles.Commands.CreateStableDraftConfirmation do
  @moduledoc """
  Confirms creation of one stable Article Draft workspace.

      article_create_draft -> stable Article and branch identity -> replay
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_create_draft,
    data_keys: ["article_id", "branch_id"],
    field_types: %{"article_id" => :string, "branch_id" => :integer}
end
