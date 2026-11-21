defmodule GroupherServerWeb.Resolvers.CMS.Passport do
  @moduledoc """
  Resolves authenticated Global Passport facts and the canonical rule catalog through GraphQL.

      authenticated User -> CMS Passport scope -> current Global Passport payload
      PermissionRegistry -> public Passport rules
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias Helper.PermissionRegistry

  def current_global(_root, _args, %{context: %{cur_user: %User{} = user}}) do
    with {:ok, %{global: %{is_root: is_root, permissions: permissions}}} <-
           CMS.passport_global_scope(user) do
      {:ok, %{is_root: is_root, permissions: permissions |> Map.keys() |> Enum.sort()}}
    end
  end

  def current_global(_root, _args, _resolution), do: {:error, :permission_denied}

  def all_passport_rules(_root, _args, _resolution) do
    %{general: root, community: moderator} = PermissionRegistry.all_rules(:cms, :stringify)

    {:ok, %{root: root, moderator: moderator}}
  end
end
