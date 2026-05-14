defmodule GroupherServer.Accounts.Search.User do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.Accounts.Model.User
  alias Helper.ORM

  @search_items_count 15

  @spec search(String.t()) :: {:ok, map()} | {:error, any()}
  def search(name) do
    User
    |> where([u], ilike(u.nickname, ^"%#{name}%") or ilike(u.login, ^"%#{name}%"))
    |> ORM.paginator(page: 1, size: @search_items_count)
    |> done()
  end
end
