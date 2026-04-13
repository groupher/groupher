defmodule GroupherServer.Accounts.Profiles.List do
  @moduledoc false

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, get_config: 2]
  import ShortMaps

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Fans
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunitySubscriber}
  alias Helper.{ORM, QueryBuilder}

  @default_subscribed_communities get_config(:general, :default_subscribed_communities)

  def paged_users(filter, %User{} = user) do
    ORM.find_all(User, filter) |> Fans.mark_viewer_follow_status(user) |> done
  end

  def paged_users(filter) do
    ORM.find_all(User, filter)
  end

  def default_subscribed_communities(%{page: _, size: _} = filter) do
    filter = Map.merge(filter, %{size: @default_subscribed_communities, category: "pl"})

    with {:ok, home_community} <- ORM.find_by(Community, slug: "home"),
         {:ok, paged_communities} <- ORM.find_all(Community, filter) do
      %{
        entries: paged_communities.entries ++ [home_community],
        page_number: paged_communities.page_number,
        page_size: paged_communities.page_size,
        total_count: paged_communities.total_count + 1,
        total_pages: paged_communities.total_pages
      }
      |> done()
    else
      _error ->
        %{
          entries: [],
          page_number: 1,
          page_size: @default_subscribed_communities,
          total_count: 0,
          total_pages: 1
        }
        |> done()
    end
  end

  def subscribed_communities(%User{id: id} = user, %{page: page, size: size} = filter) do
    filter = filter |> Map.delete(:first)

    CommunitySubscriber
    |> where([c], c.user_id == ^id)
    |> join(:inner, [c], cc in assoc(c, :community))
    |> select([c, cc], cc)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> sort_communities(user)
    |> done()
  end

  defp sort_communities(paged_communities, user) do
    _user = user
    paged_communities
  end
end
