defmodule GroupherServer.FrontDesk.Cache do
  @moduledoc """
  Cache helpers for the public FrontDesk facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.FrontDesk
  alias Helper.Cache

  @pool :frontdesk_user

  @spec user(String.t()) :: {:ok, User.t()} | {:error, any()}
  def user(login) when is_binary(login) do
    case Cache.get(@pool, user_scope(login)) do
      {:ok, %User{} = user} -> {:ok, user}
      {:error, _} -> FrontDesk.revalidate().user(login)
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
