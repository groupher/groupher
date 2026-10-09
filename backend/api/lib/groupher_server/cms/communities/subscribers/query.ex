defmodule GroupherServer.CMS.Communities.Subscribers.Query do
  @moduledoc """
  Read-only queries for Community subscribers.

      Communities facade
        -> Subscribers.Query
        -> QueryBuilder / Repo
        -> paged subscriber users
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Model.{Community, CommunitySubscriber}
  alias CMS.QueryBuilder
  alias Helper.{ORM, T}

  @spec page(Community.t(), map()) :: T.domain_res(T.paged_data())
  def page(%Community{id: id}, %{page: page, size: size} = filters) when not is_nil(id) do
    CommunitySubscriber
    |> where([subscriber], subscriber.community_id == ^id)
    |> QueryBuilder.load_inner_users(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  def page(%Community{slug: slug}, %{page: page, size: size} = filters)
      when not is_nil(slug) do
    CommunitySubscriber
    |> join(:inner, [subscriber], community in assoc(subscriber, :community))
    |> where([_subscriber, community], community.slug == ^slug)
    |> join(:inner, [subscriber, _community], user in assoc(subscriber, :user))
    |> select([_subscriber, _community, user], user)
    |> QueryBuilder.filter_pack(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  @spec page(Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def page(%Community{} = community, filters, %User{} = user) do
    with {:ok, subscribers} <- page(community, filters) do
      %{entries: entries} = subscribers

      entries =
        Enum.map(entries, fn subscriber ->
          %{subscriber | viewer_has_followed: subscriber.id in user.meta.following_user_ids}
        end)

      %{subscribers | entries: entries} |> done
    end
  end
end
