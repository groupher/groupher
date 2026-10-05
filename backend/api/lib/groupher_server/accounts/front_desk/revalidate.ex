defmodule GroupherServer.Accounts.FrontDesk.Revalidate do
  @moduledoc """
  Accounts-owned User cache revalidation boundary.

  Business position:

      Root FrontDesk
        -> Accounts.FrontDesk.Revalidate
        -> Accounts.FrontDesk.fresh_user/1
        -> User cache
  """

  alias GroupherServer.Accounts.FrontDesk
  alias FrontDesk.Cache

  @spec user(String.t()) :: {:ok, any()} | {:error, any()}
  def user(login) when is_binary(login) do
    with {:ok, user} <- FrontDesk.fresh_user(login) do
      _ = Cache.put_user(user)
      {:ok, user}
    end
  end

  @spec users([String.t()]) :: {:ok, [any()]} | {:error, any()}
  def users(logins) when is_list(logins) do
    logins
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.reduce_while({:ok, []}, fn login, {:ok, users} ->
      case user(login) do
        {:ok, user} -> {:cont, {:ok, [user | users]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, users} -> {:ok, Enum.reverse(users)}
      error -> error
    end
  end
end
