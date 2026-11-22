defmodule GroupherServerWeb.Resolvers.Accounts.Passport do
  @moduledoc """
  Adapts account Passport GraphQL fields to the public Accounts and CMS facades.

      GraphQL Passport field -> this resolver -> Accounts/CMS Passport facade
  """
  alias GroupherServer.CMS

  def get_passport(root, _args, %{context: %{cur_user: _}}) do
    CMS.communities_get_passport(root)
  end

  def get_passport_string(root, _args, %{context: %{cur_user: _}}) do
    with {:ok, passport} <- CMS.communities_get_passport(root) do
      {:ok, Jason.encode!(passport)}
    end
  end

end
