defmodule GroupherServer.Accounts.FrontDesk do
  @moduledoc """
  Accounts domain front desk for fetching user/userid.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.{Cache, ORM}

  @cache_pool :user_login

  @spec userid(String.t()) :: {:ok, integer()} | {:error, any()}
  def userid(login) when is_binary(login) do
    case Cache.get(@cache_pool, login) do
      {:ok, user_id} -> {:ok, user_id}
      {:error, _} -> cache_userid(login)
    end
  end

  @spec user(integer() | String.t(), keyword()) :: {:ok, User.t()} | {:error, any()}
  def user(target, opts \\ [])

  def user(id, opts) when is_integer(id) do
    preload = Keyword.get(opts, :preload)

    with {:ok, user} <- fetch_user_by_id(id, preload) do
      maybe_fill_meta(user, opts)
    end
  end

  def user(login, opts) when is_binary(login) do
    with {:ok, user_id} <- userid(login) do
      case user(user_id, opts) do
        {:ok, user} -> {:ok, user}
        {:error, _} -> reload_user_by_login(login, opts)
      end
    end
  end

  defp cache_userid(login) do
    with {:ok, user} <- ORM.find_by(User, %{login: login}) do
      Cache.put(@cache_pool, login, user.id)
      {:ok, user.id}
    end
  end

  defp fetch_user_by_id(id, nil), do: ORM.find(User, id)
  defp fetch_user_by_id(id, preload), do: ORM.find(User, id, preload: preload)

  defp reload_user_by_login(login, opts) do
    with {:ok, user_id} <- cache_userid(login) do
      user(user_id, opts)
    end
  end

  defp maybe_fill_meta(user, opts) do
    case Keyword.get(opts, :fill_meta, true) do
      true -> ORM.fill_meta(user)
      false -> {:ok, user}
    end
  end
end
