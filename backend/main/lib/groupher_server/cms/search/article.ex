defmodule GroupherServer.CMS.Search.Article do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.Helper.Matcher

  alias Helper.ORM

  @search_items_count 15

  def search(thread, title) do
    with {:ok, info} <- match(thread) do
      info.model
      |> where([a], ilike(a.title, ^"%#{title}%"))
      |> ORM.paginator(page: 1, size: @search_items_count)
      |> done()
    end
  end
end
