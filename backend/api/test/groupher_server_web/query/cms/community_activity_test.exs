defmodule GroupherServer.Test.Query.CMS.CommunityActivityTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Model.CommunityAdmin

  @query """
  query CommunityActivity($community: String!, $selection: CommunityActivitySelectionInput!) {
    communityActivity(community: $community, selection: $selection) {
      entries { action }
    }
  }
  """

  test "GraphQL passes the authorized Community Passport scope to CommunityLog" do
    {community, _post, _attrs, _owner} = mock_article(:post)
    {:ok, manager} = db_insert(:user)

    %CommunityAdmin{}
    |> CommunityAdmin.changeset(%{
      user_id: manager.id,
      community_id: community.id,
      permissions: %{"audit.read" => true}
    })
    |> Repo.insert!()

    assert {:ok, _event} =
             Activity.log(
               %{activity_type: :community, community_id: community.id, ref: community.slug},
               :activated,
               actor: manager
             )

    result =
      gq_query(simu_conn(:user, manager), @query, %{
        community: community.slug,
        selection: %{filter: %{actions: ["activated"]}}
      })

    assert Enum.any?(result["entries"], &(&1["action"] == "activated"))

    now = DateTime.utc_now(:second)

    stats_query = """
    query Stats($community: String!, $selection: CommunityActivitySelectionInput!) {
      communityActivityStats(community: $community, selection: $selection) { totalCount }
    }
    """

    stats =
      gq_query(simu_conn(:user, manager), stats_query, %{
        community: community.slug,
        selection: %{
          filter: %{
            occurredAfter: DateTime.to_iso8601(DateTime.add(now, -1, :day)),
            occurredBefore: DateTime.to_iso8601(DateTime.add(now, 1, :day)),
            actions: ["activated"]
          }
        }
      })

    assert stats["totalCount"] >= 1
  end

  test "stats reuses a supplied scope without loading Passport facts again" do
    {community, _post, _attrs, owner} = mock_article(:post)
    {:ok, scope} = CMS.passport_community_scope(owner, community)
    now = DateTime.utc_now(:second)
    selection = %{filter: %{occurred_after: DateTime.add(now, -1, :day), occurred_before: now}}

    {loaded, loaded_queries} =
      capture_queries(fn -> Activity.get_community_log_stats(community, owner, selection) end)

    {reused, reused_queries} =
      capture_queries(fn ->
        Activity.get_community_log_stats(community, owner, selection, passport_scope: scope)
      end)

    assert {:ok, loaded_result} = loaded
    assert {:ok, ^loaded_result} = reused

    assert length(loaded_queries) > length(reused_queries)
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _event, _measurements, metadata, {pid, tag} ->
          send(pid, {tag, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> queries
    end
  end
end
