defmodule GroupherServer.Test.Query.CMS.GEO do
  @moduledoc false

  use GroupherServer.TestTools

  @remote_ip get_config(:test, :remote_ip)

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, community} = db_insert(:community)
    {:ok, user} = db_insert(:user)

    {:ok, ~m(guest_conn community user)a}
  end

  @query """
  query($id: ID!) {
    communityGeoInfo(id: $id) {
      city
      long
      lant
      value
    }
  }
  """
  test "empty community should get empty geo info", ~m(guest_conn community)a do
    variables = %{id: community.id}
    results = guest_conn |> gq_query(@query, variables)

    assert results == []
  end

  test "community should get geo info after subscribe", ~m(guest_conn community user)a do
    {:ok, _record} = CMS.subscribe_community(community, user, @remote_ip)

    variables = %{id: community.id}
    results = guest_conn |> gq_query(@query, variables)

    assert results |> List.first() |> Map.get("value") == 1
    assert results |> List.first() |> Map.get("city") == "成都"
  end
end
