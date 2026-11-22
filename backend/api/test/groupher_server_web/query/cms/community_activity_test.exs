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
  end
end
