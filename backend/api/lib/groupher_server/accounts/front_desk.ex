defmodule GroupherServer.Accounts.FrontDesk do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.Accounts.FrontDesk -> result
  """

  @doc """
  Delegates fresh_user/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.FrontDesk.fresh_user(...)
  """
  defdelegate fresh_user(arg1), to: GroupherServer.Accounts.FrontDesk.Query

  @doc """
  Delegates user/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.FrontDesk.user(...)
  """
  defdelegate user(arg1), to: GroupherServer.Accounts.FrontDesk.Query

  @doc """
  Delegates a validated mode/view User read to the owning Query.

  ## Examples

      FrontDesk.user("alice", mode: :public, view: :default)
  """
  @spec user(integer() | String.t(), keyword()) ::
          {:ok, Accounts.Model.User.t()} | {:error, term()}
  defdelegate user(ref, opts), to: GroupherServer.Accounts.FrontDesk.Query

  @doc """
  Delegates userid/1 to the owning implementation.

  ## Examples

      iex> GroupherServer.Accounts.FrontDesk.userid(...)
  """
  defdelegate userid(arg1), to: GroupherServer.Accounts.FrontDesk.Query
end
