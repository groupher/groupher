defmodule GroupherServer.Test.Statistics.PublishThrottle do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.{CMS, Statistics}
  alias Statistics.Model.PublishThrottle

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)

    {:ok, ~m(user_conn guest_conn community user)a}
  end

  test "user first create content should add fresh throttle record.", ~m(community user)a do
    post_attrs = mock_attrs(:post, %{community_id: community.id})
    {:ok, _} = CMS.create_article(community, :post, post_attrs, user)

    {:ok, pt_record} = PublishThrottle |> ORM.find_by(user_id: user.id)

    assert pt_record.date_count == 1
    assert pt_record.hour_count == 1
  end

  test "user create 2 content should update throttle record.", ~m(community)a do
    {:ok, user} = db_insert(:user)
    post_attrs = mock_attrs(:post, %{community_id: community.id})
    post_attrs2 = mock_attrs(:post, %{community_id: community.id})
    {:ok, _} = CMS.create_article(community, :post, post_attrs, user)
    {:ok, _} = CMS.create_article(community, :post, post_attrs2, user)

    {:ok, pt_record} = PublishThrottle |> ORM.find_by(user_id: user.id)

    assert pt_record.date_count == 2
    assert pt_record.hour_count == 2
  end
end
