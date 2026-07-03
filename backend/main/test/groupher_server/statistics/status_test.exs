defmodule GroupherServer.Test.Statistics.Status do
  use GroupherServer.TestMate

  # alias Helper.ORM
  alias GroupherServer.Statistics
  alias Helper.Cache

  @communities_count 10
  # @posts_count 11

  defp create_communities!(count, user) do
    Enum.each(1..count, fn _ ->
      community_attrs = mock_attrs(:community)
      {:ok, _community} = CMS.Communities.create(community_attrs, user)
    end)
  end

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, before_counts} = Statistics.count_status()

    create_communities!(@communities_count, user)

    {:ok, before_counts: before_counts}
  end

  test "can get basic online state" do
    {:ok, state} = Statistics.online_status()
    assert state == %{realtime_visitors: 1}
    Cache.put(:online_status, :realtime_visitors, 10)

    {:ok, state} = Statistics.online_status()
    assert state == %{realtime_visitors: 10}
  end

  test "can get basic count info of the whole site", %{before_counts: before_counts} do
    {:ok, counts} = Statistics.count_status()

    assert counts.communities_count >= before_counts.communities_count + @communities_count
    # assert counts.posts_count == @posts_count
    # TODO: more
  end
end
