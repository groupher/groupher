defmodule GroupherServer.FrontDesk.Revalidate do
  @moduledoc """
  Revalidate cached FrontDesk resources.

  Business position:

      Resolver / context
        -> FrontDesk
        -> Revalidate
        -> cache / Repo
  """

  alias GroupherServer.FrontDesk
  alias GroupherServer.FrontDesk.Cache

  @spec user(String.t()) :: {:ok, any()} | {:error, any()}
  def user(login) when is_binary(login) do
    with {:ok, user} <- FrontDesk.live_user(login) do
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
