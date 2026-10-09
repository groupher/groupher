defmodule GroupherServer.CMS.Communities.Moderators.Query do
  @moduledoc """
  Read-only queries for Community moderators.

      Communities facade
        -> Moderators.Query
        -> QueryBuilder / Repo
        -> paged moderator users
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import ShortMaps

  alias GroupherServer.CMS
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.QueryBuilder
  alias Helper.{ORM, T}

  @spec page(Community.t(), map()) :: T.domain_res(T.paged_data())
  def page(%Community{id: id}, %{page: page, size: size} = filters) when not is_nil(id) do
    CommunityModerator
    |> where([moderator], moderator.community_id == ^id)
    |> QueryBuilder.load_inner_users(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  def page(%Community{slug: slug}, %{page: page, size: size} = filters)
      when not is_nil(slug) do
    CommunityModerator
    |> join(:inner, [moderator], community in assoc(moderator, :community))
    |> where([_moderator, community], community.slug == ^slug)
    |> join(:inner, [moderator, _community], user in assoc(moderator, :user))
    |> select([_moderator, _community, user], user)
    |> QueryBuilder.filter_pack(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end
end
