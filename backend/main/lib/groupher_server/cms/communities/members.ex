defmodule GroupherServer.CMS.Communities.Members do
  @moduledoc """
  Members helpers for communities.
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias Helper.{ORM, QueryBuilder}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityModerator, CommunitySubscriber}

  @doc """
  return paged community subscribers
  """
  @spec members(atom(), Community.t(), map()) :: T.domain_res(term())
  def members(:moderators, %Community{id: id} = community, filters)
      when not is_nil(id) do
    load_community_members(community, CommunityModerator, filters)
  end

  def members(:moderators, %Community{slug: slug} = community, filters)
      when not is_nil(slug) do
    load_community_members(community, CommunityModerator, filters)
  end

  def members(:subscribers, %Community{id: id} = community, filters)
      when not is_nil(id) do
    load_community_members(community, CommunitySubscriber, filters)
  end

  def members(:subscribers, %Community{slug: slug} = community, filters)
      when not is_nil(slug) do
    load_community_members(community, CommunitySubscriber, filters)
  end

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(term())
  def members(:subscribers, %Community{id: id} = community, filters, %User{} = user)
      when not is_nil(id) do
    with {:ok, members} <- members(:subscribers, community, filters) do
      %{entries: entries} = members

      entries =
        Enum.map(entries, fn member ->
          %{member | viewer_has_followed: member.id in user.meta.following_user_ids}
        end)

      %{members | entries: entries} |> done
    end
  end

  defp load_community_members(%Community{id: id}, queryable, %{page: page, size: size} = filters)
       when not is_nil(id) do
    queryable
    |> where([c], c.community_id == ^id)
    |> QueryBuilder.load_inner_users(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  defp load_community_members(
         %Community{slug: slug},
         queryable,
         %{page: page, size: size} = filters
       ) do
    queryable
    |> join(:inner, [member], c in assoc(member, :community))
    |> where([member, c], c.slug == ^slug)
    |> join(:inner, [member], u in assoc(member, :user))
    |> select([member, c, u], u)
    |> QueryBuilder.filter_pack(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end
end
