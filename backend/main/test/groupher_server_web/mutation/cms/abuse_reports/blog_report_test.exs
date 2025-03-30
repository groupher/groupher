defmodule GroupherServer.Test.Mutation.AbuseReports.BlogReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community blog)a}
  end

  describe "[blog report/undo_report]" do
    test "login user can report a blog", ~m(community blog user user_conn)a do
      variables = %{id: blog.inner_id, community: community.slug, reason: "reason"}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :blog), variables)
      assert article["id"] == to_string(blog.id)
    end

    test "login user can undo report a blog", ~m(community blog user user_conn)a do
      variables = %{id: blog.inner_id, reason: "reason", community: community.slug}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :blog), variables)
      assert article["id"] == to_string(blog.id)

      variables = %{id: blog.inner_id, community: community.slug}

      article = user_conn |> gq_mutation(Schema.m(:undo_report_article, :blog), variables)
      assert article["id"] == to_string(blog.id)
    end
  end
end
