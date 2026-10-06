defmodule GroupherServerWeb.Resolvers.Accounts.Passport do
  @moduledoc """
  Adapts account Passport GraphQL fields to the public Accounts and CMS facades.

      GraphQL Passport field -> this resolver -> Accounts/CMS Passport facade
  """
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Passport.Registry

  def get_passport(root, _args, %{context: %{cur_user: _}}) do
    CMS.Communities.get_passport(root)
  end

  def get_passport_string(root, _args, %{context: %{cur_user: _}}) do
    with {:ok, passport} <- CMS.Communities.get_passport(root) do
      {:ok, Jason.encode!(passport)}
    end
  end

  def get_all_rules(_root, _args, %{context: %{cur_user: _}}) do
    cms_rules = Registry.all_rules(:cms, :stringify)
    {:ok, %{cms: cms_rules}}
  end
end
