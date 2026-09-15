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

  alias Accounts.Model.User
  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias Helper.{Cache, ORM}

  @cache_pool :user_login

  @doc "Runs `userid` through the public `FrontDesk` boundary."
  @spec userid(String.t()) :: {:ok, integer()} | {:error, any()}
  def userid(login) when is_binary(login) do
    case Cache.get(@cache_pool, login) do
      {:ok, user_id} -> {:ok, user_id}
      {:error, _} -> cache_userid(login)
    end
  end

  @doc "Runs `user` through the public `FrontDesk` boundary."
  @spec user(String.t(), keyword()) :: {:ok, User.t()} | {:error, any()}
  def user(login, opts \\ []) when is_binary(login), do: live_user(login, opts)

  @doc "Runs `live_user` through the public `FrontDesk` boundary."
  @spec live_user(String.t(), keyword()) :: {:ok, User.t()} | {:error, any()}
  def live_user(login, opts \\ []) when is_binary(login) do
    with {:ok, user_id} <- userid(login) do
      case fetch_user_by_id(user_id, opts) do
        {:ok, user} -> {:ok, user}
        {:error, _} -> reload_user_by_login(login, opts)
      end
    end
  end

  defp cache_userid(login) do
    case ORM.find_by(User, %{login: login}) do
      {:ok, user} ->
        Cache.put(@cache_pool, login, user.id)
        {:ok, user.id}

      {:error,
       ProfileErrorCat.error_pattern(details: %{reason: :not_exist, message: message})} ->
        {:error, ProfileErrorCat.not_exist(message)}

      {:error, error} ->
        {:error, error}
    end
  end

  defp fetch_user_by_id(id, opts) do
    preload = Keyword.get(opts, :preload)

    with {:ok, user} <- do_fetch_user_by_id(id, preload) do
      maybe_fill_meta(user, opts)
    end
  end

  defp do_fetch_user_by_id(id, nil), do: ORM.find(User, id)
  defp do_fetch_user_by_id(id, preload), do: ORM.find(User, id, preload: preload)

  defp reload_user_by_login(login, opts) do
    with {:ok, user_id} <- cache_userid(login) do
      fetch_user_by_id(user_id, opts)
    end
  end

  defp maybe_fill_meta(user, opts) do
    case Keyword.get(opts, :fill_meta, true) do
      true -> ORM.fill_meta(user)
      false -> {:ok, user}
    end
  end
end
