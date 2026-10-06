defmodule GroupherServer.Accounts.FrontDesk do
  @moduledoc """
  Accounts domain front desk for fetching user/userid.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> FrontDesk
        -> Repo
  """

  require GroupherServer.Accounts.Profiles.ErrorCat

  alias GroupherServer.Accounts
  alias __MODULE__.Cache

  alias Accounts.Model.User
  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias Helper.Cache, as: CacheStore
  alias Helper.ORM

  @cache_pool :user_login

  @doc "Runs `userid` through the public `FrontDesk` boundary."
  @spec userid(String.t()) :: {:ok, integer()} | {:error, any()}
  def userid(login) when is_binary(login) do
    case CacheStore.get(@cache_pool, login) do
      {:ok, user_id} -> {:ok, user_id}
      {:error, _} -> cache_userid(login)
    end
  end

  @doc "Runs `user` through the public `FrontDesk` boundary."
  @spec user(integer() | String.t()) :: {:ok, User.t()} | {:error, any()}
  def user(id) when is_integer(id), do: fetch_user_by_id(id)
  def user(login) when is_binary(login), do: Cache.user(login)

  @doc "Reads the current User row, bypassing the full User cache."
  @spec fresh_user(integer() | String.t()) :: {:ok, User.t()} | {:error, any()}
  def fresh_user(id) when is_integer(id), do: fetch_user_by_id(id)

  def fresh_user(login) when is_binary(login) do
    with {:ok, user_id} <- userid(login) do
      case fetch_user_by_id(user_id) do
        {:ok, user} -> {:ok, user}
        {:error, _} -> reload_user_by_login(login)
      end
    end
  end

  defp cache_userid(login) do
    case ORM.find_by(User, %{login: login}) do
      {:ok, user} ->
        CacheStore.put(@cache_pool, login, user.id)
        {:ok, user.id}

      {:error, ProfileErrorCat.error_pattern(details: %{reason: :not_exist, message: message})} ->
        {:error, ProfileErrorCat.not_exist(message)}

      {:error, error} ->
        {:error, error}
    end
  end

  defp fetch_user_by_id(id) do
    with {:ok, user} <- ORM.find(User, id) do
      ORM.fill_meta(user)
    end
  end

  defp reload_user_by_login(login) do
    with {:ok, user_id} <- cache_userid(login) do
      fetch_user_by_id(user_id)
    end
  end
end
