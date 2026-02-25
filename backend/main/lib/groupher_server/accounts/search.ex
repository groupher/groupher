defmodule GroupherServer.Accounts.Search do
  @moduledoc """
  Accounts search facade.
  """

  alias __MODULE__.User
  alias Helper.T

  @spec user(String.t()) :: T.domain_res(T.paged_users())
  def user(name) when is_binary(name), do: User.search(name)
end
