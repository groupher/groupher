defmodule GroupherServer.Accounts.Fans.ErrorCat do
  @moduledoc """
  Account fan and follow error catalog.

  Fan operation -> catalog reason -> stable protocol error.
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:account, :fans}

  error(:self_conflict, code: 4801)
  error(:not_exist, code: 4802)
  error(:already_did, code: 4803)
  error(:react_fails, code: 4804)
end
