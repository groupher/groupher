defmodule GroupherServer.Accounts.CollectFolders.List do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.Accounts.Model.{CollectFolder, User}
  alias Helper.{ORM, QueryBuilder, T}

  @spec page(T.id(), map()) :: T.domain_res(T.paged_data())
  def page(user_id, filter) do
    query = CollectFolder |> where([c], c.user_id == ^user_id and not c.private)
    do_paged(filter, query)
  end

  @spec page(T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def page(user_id, filter, %User{id: cur_user_id}) do
    query =
      if cur_user_id == user_id,
        do: CollectFolder |> where([c], c.user_id == ^user_id),
        else: CollectFolder |> where([c], c.user_id == ^user_id and not c.private)

    do_paged(filter, query)
  end

  defp do_paged(filter, query) do
    %{page: page, size: size} = filter

    query
    |> filter_thread_ifneed(filter)
    |> QueryBuilder.filter_pack(Map.delete(filter, :thread))
    |> ORM.paginator(page: page, size: size)
    |> done()
  end

  defp filter_thread_ifneed(query, %{thread: thread}) do
    field_name = "has_#{thread}"
    query |> where([f], fragment("(?->>?)::boolean = ?", f.meta, ^field_name, true))
  end

  defp filter_thread_ifneed(query, _), do: query
end
