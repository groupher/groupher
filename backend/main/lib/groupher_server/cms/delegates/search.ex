defmodule GroupherServer.CMS.Delegate.Search do
  @moduledoc """
  search for community, post, job ...
  """
  import Helper.Utils, only: [done: 1]
  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  alias Helper.ORM
  alias Helper.Types, as: T

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Model.{Community}
  alias Accounts.Model.{User}

  @search_items_count 15

  @doc """
  search community by title
  """
  @spec search_communities(String.t()) :: T.domain_res(term())
  def search_communities(title) do
    do_search_communities(Community, title)
  end

  @spec search_communities(String.t(), User.t()) :: T.domain_res(term())
  def search_communities(title, %User{} = user) do
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

  @spec search_communities(String.t(), term()) :: T.domain_res(term())
  def search_communities(title, category) do
    from(
      c in Community,
      join: cat in assoc(c, :categories),
      where: cat.slug == ^category
    )
    |> do_search_communities(title)
  end

  @spec search_communities(String.t(), term(), User.t()) :: T.domain_res(term())
  def search_communities(title, category, %User{meta: _}) do
    search_communities(title, category)
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

  @doc """
  search article by title
  """
  @spec search_articles(atom(), map()) :: T.domain_res(term())
  def search_articles(thread, %{title: title}) do
    with {:ok, info} <- match(thread) do
      info.model
      # |> where([c], ilike(c.title, ^"%#{title}%") or ilike(c.digest, ^"%#{title}%"))
      |> where([c], ilike(c.title, ^"%#{title}%"))
      |> ORM.paginator(page: 1, size: @search_items_count)
      |> done()
    end
  end
end
