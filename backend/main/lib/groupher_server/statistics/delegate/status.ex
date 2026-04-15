defmodule GroupherServer.Statistics.Delegate.Status do
  @moduledoc """
  basic count info of the whole site, used in admin panel sidebar
  """

  import Ecto.Query, warn: false
  import ShortMaps

  alias GroupherServer.CMS

  alias CMS.Model.{
    Blog,
    Category,
    Community,
    CommunityTag,
    Post
  }

  alias Helper.{Cache, ORM}

  @cache_pool :online_status
  @count_filter %{page: 1, size: 1}

  def online_status do
    case Cache.get(@cache_pool, :realtime_visitors) do
      {:ok, realtime_visitors} -> {:ok, %{realtime_visitors: realtime_visitors}}
      _ -> {:ok, %{realtime_visitors: 1}}
    end
  end

  def count_status do
    {:ok, %{total_count: communities_count}} = find_total_count(Community)
    {:ok, %{total_count: posts_count}} = find_total_count(Post)
    {:ok, %{total_count: blogs_count}} = find_total_count(Blog)

    {:ok, %{total_count: community_tags_count}} = find_total_count(CommunityTag)
    {:ok, %{total_count: categories_count}} = find_total_count(Category)

    {:ok,
     ~m(communities_count posts_count blogs_count community_tags_count categories_count)a}
  end

  defp find_total_count(queryable), do: ORM.find_all(queryable, @count_filter)
end
