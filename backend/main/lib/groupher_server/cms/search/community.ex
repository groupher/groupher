defmodule GroupherServer.CMS.Search.Community do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Community
  alias Helper.ORM

  @search_items_count 15

  def search(title) do
    do_search_communities(Community, title)
  end

  def search(title, %User{} = user) do
    with {:ok, communities} <- do_search_communities(Community, title) do
      %{entries: entries} = communities

      entries =
        Enum.map(entries, fn community ->
          viewer_has_subscribed = community.id in user.meta.subscribed_communities_ids
          %{community | viewer_has_subscribed: viewer_has_subscribed}
        end)

      %{communities | entries: entries} |> done
    end
  end

  def search(title, category) when is_binary(category) do
    do_search_communities_with_category(title, category)
  end

  def search(title, category, %User{meta: _} = user) when is_binary(category) do
    with {:ok, communities} <- do_search_communities_with_category(title, category) do
      %{entries: entries} = communities

      entries =
        Enum.map(entries, fn community ->
          viewer_has_subscribed = community.id in user.meta.subscribed_communities_ids
          %{community | viewer_has_subscribed: viewer_has_subscribed}
        end)

      %{communities | entries: entries} |> done
    end
  end

  defp do_search_communities(queryable, title) do
    queryable
    |> where(
      [c],
      ilike(c.title, ^"%#{title}%") or ilike(c.slug, ^"%#{title}%") or ilike(c.aka, ^"%#{title}%")
    )
    |> ORM.paginator(page: 1, size: @search_items_count)
    |> done()
  end

  defp do_search_communities_with_category(title, category) do
    from(
      c in Community,
      join: cat in assoc(c, :categories),
      where: cat.slug == ^category
    )
    |> do_search_communities(title)
  end
end
