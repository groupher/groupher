defmodule GroupherServer.CMS.Search.Article do
  @moduledoc """
  Lightweight title search for CMS article threads.

  The search entrypoint receives a public thread atom, resolves it through the
  artiment matcher, and runs the same bounded paginator for posts, blogs,
  changelogs, or docs.
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.Artiment.Matcher

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
