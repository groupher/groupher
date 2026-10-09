defmodule GroupherServer.CMS.Communities.Tags.Query do
  @moduledoc """
  Read-only query boundary for community tags and tag groups.

  Business position:

      GraphQL / query caller
        -> CMS.Communities.Tags.Query
        -> QueryBuilder / Repo
        -> tag-group projection
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.Repo
  alias GroupherServer.CMS.QueryBuilder
  alias GroupherServer.CMS.Model.{CommunityTag, CommunityTagGroup}
  alias Helper.T

  @doc "Returns tag-group titles keyed by id in one query."
  @spec group_titles([T.id()]) :: map()
  def group_titles(ids) when is_list(ids) do
    CommunityTagGroup
    |> where([group], group.id in ^Enum.uniq(ids))
    |> select([group], {group.id, group.title})
    |> Repo.all()
    |> Map.new()
  end

  @doc "Lists tag groups and their ordered tags through the read boundary."
  @spec groups(map()) :: {:ok, list(CommunityTagGroup.t())} | {:error, any()}
  def groups(filter) do
    filter = replace_community_ifneed(filter)

    CommunityTagGroup
    |> QueryBuilder.filter_pack(filter)
    |> order_by([g], asc: g.index, asc: g.id)
    |> preload([g],
      tags:
        ^from(t in CommunityTag,
          order_by: [asc: t.index, asc: t.id],
          preload: [:community, :tag_group]
        )
    )
    |> Repo.all()
    |> done()
  end

  defp replace_community_ifneed(filter) when is_map(filter) do
    filter
    |> Enum.map(fn {k, v} ->
      new_key =
        case k do
          :community -> :community_slug
          _ -> k
        end

      {new_key, v}
    end)
    |> Map.new()
  end
end
