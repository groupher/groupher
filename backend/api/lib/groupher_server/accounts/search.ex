defmodule GroupherServer.Accounts.Search do
  @moduledoc """
  Public account-search boundary for nickname and login matching.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Search
        -> Repo
  """

  alias __MODULE__.User
  alias Helper.T

  @spec user(String.t()) :: T.domain_res(T.paged_users())
  @doc "Runs `user` through the public `Search` boundary."
  def user(name) when is_binary(name), do: User.search(name)
end
