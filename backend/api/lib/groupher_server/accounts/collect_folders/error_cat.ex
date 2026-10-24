defmodule GroupherServer.Accounts.CollectFolders.ErrorCat do
  @moduledoc """
  Account collection-folder error catalog.

  Collection operation -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat, namespace: {:account, :collection}

  error(:already_collected_in_folder, code: 4702)
  error(:delete_no_empty_collect_folder, code: 4703)
  error(:private_collect_folder, code: 4704)
  error(:not_collected_in_folder, code: 4705)
  error(:already_exist, code: 4701)
  error(:binding_context_required, code: 4706)
end
