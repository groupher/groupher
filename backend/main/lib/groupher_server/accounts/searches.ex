defmodule GroupherServer.Accounts.Searches do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Search

  @spec search_users(map()) :: T.domain_res(T.paged_users())
  def search_users(args), do: Search.search_users(args)
end
