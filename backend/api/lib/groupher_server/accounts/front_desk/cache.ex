defmodule GroupherServer.Accounts.FrontDesk.Cache do
  @moduledoc """
  Accounts-owned cache helpers for the User FrontDesk boundary.

  Business position:

      Root FrontDesk / Accounts caller
        -> Accounts.FrontDesk
        -> Accounts.FrontDesk.Cache
        -> cache / Repo
  """

  alias GroupherServer.Accounts
  alias GroupherServer.Accounts.FrontDesk

  alias Accounts.Model.User
  alias Helper.Cache

  @pool :frontdesk_user

  @spec user(String.t()) :: {:ok, User.t()} | {:error, any()}
  def user(login) when is_binary(login) do
    case Cache.get(@pool, user_scope(login)) do
      {:ok, %User{} = user} -> {:ok, user}
      _ -> FrontDesk.Revalidate.user(login)
    end
  end

  @spec put_user(User.t()) :: {:ok, boolean()} | {:error, any()}
  def put_user(%User{login: login} = user) when is_binary(login) do
    Cache.put(@pool, user_scope(login), user)
  end

  @spec delete_user(String.t()) :: {:ok, boolean()} | {:error, any()}
  def delete_user(login) when is_binary(login), do: Cache.delete(@pool, user_scope(login))

  defp user_scope(login), do: "user:#{login}"
end
