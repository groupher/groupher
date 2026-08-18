defmodule GroupherServer.Accounts.CollectFolders.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:account, :collection}

  error(:already_collected_in_folder, code: 4702)
  error(:delete_no_empty_collect_folder, code: 4703)
  error(:private_collect_folder, code: 4704)
  error(:already_exist, code: 4701)
end
