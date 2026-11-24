defmodule GroupherServerWeb.Resolvers.CMS.Passport do
  @moduledoc """
  Resolves authenticated Global Passport facts through GraphQL.

      authenticated User -> CMS Passport scope -> current Global Passport payload
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  @doc "Returns the viewer's global root flag and sorted permission keys; denies anonymous requests."
  def current_global(_root, _args, %{context: %{cur_user: %User{} = user}}) do
    with {:ok, %{global: %{is_root: is_root, permissions: permissions}}} <-
           CMS.passport_global_scope(user) do
      {:ok, %{is_root: is_root, permissions: permissions |> Map.keys() |> Enum.sort()}}
    end
  end

  def current_global(_root, _args, _resolution), do: {:error, :permission_denied}
end
