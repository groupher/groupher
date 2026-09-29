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

  @doc "Runs `user` through the public `Search` boundary."
  @spec user(String.t()) :: T.domain_res(T.paged_users())
  def user(name) when is_binary(name), do: User.search(name)
end
