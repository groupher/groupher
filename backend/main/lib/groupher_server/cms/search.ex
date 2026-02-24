defmodule GroupherServer.CMS.Search do
  @moduledoc """
  CMS search facade.
  """

  import Helper.Utils, only: [done: 1]
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.ORM
  alias Helper.Types, as: T

  @search_items_count 15

  @spec communities(String.t()) :: T.domain_res(T.paged_data())
  def communities(title) do
    do_search_communities(Community, title)
  end

  @spec communities(String.t(), User.t()) :: T.domain_res(T.paged_data())
  def communities(title, %User{} = user) do
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

  @spec communities(String.t(), String.t()) :: T.domain_res(T.paged_data())
  def communities(title, category) when is_binary(category) do
    do_search_communities_with_category(title, category)
  end

  @spec communities(String.t(), String.t(), User.t()) :: T.domain_res(T.paged_data())
  def communities(title, category, %User{meta: _} = user) when is_binary(category) do
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

  @spec articles(T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def articles(thread, %{title: title}) do
    with {:ok, info} <- match(thread) do
      info.model
      |> where([c], ilike(c.title, ^"%#{title}%"))
      |> ORM.paginator(page: 1, size: @search_items_count)
      |> done()
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
