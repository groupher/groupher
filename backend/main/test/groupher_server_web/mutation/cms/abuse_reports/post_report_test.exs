defmodule GroupherServer.Test.Mutation.AbuseReports.PostReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community post)a}
  end

  describe "[post report/undo_report]" do
    test "login user can report a post", ~m(community post user_conn)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}, reason: "reason"}
      article = user_conn |> gq_mutation(Schema.m(:report_article, :post), variables)

      assert article["innerId"] == to_string(post.inner_id)
    end

    test "login user can undo report a post", ~m(community post user_conn)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}, reason: "reason"}
      article = user_conn |> gq_mutation(Schema.m(:report_article, :post), variables)

      assert article["innerId"] == to_string(post.inner_id)

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      article = user_conn |> gq_mutation(Schema.m(:undo_report_article, :post), variables)
      assert article["innerId"] == to_string(post.inner_id)
    end
  end
end
