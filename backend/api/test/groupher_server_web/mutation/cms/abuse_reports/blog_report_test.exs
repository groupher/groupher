defmodule GroupherServer.Test.Mutation.AbuseReports.BlogReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community blog)a}
  end

  describe "[blog report/undo_report]" do
    test "login user can report a blog", ~m(community blog user_conn)a do
      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"},
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :blog), variables)
      assert article["innerId"] == to_string(blog.inner_id)
    end

    test "login user can undo report a blog", ~m(community blog user_conn)a do
      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"},
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :blog), variables)
      assert article["innerId"] == to_string(blog.inner_id)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"}
      }

      article = user_conn |> gq_mutation(S.Article.m(:undo_report_article, :blog), variables)
      assert article["innerId"] == to_string(blog.inner_id)
    end
  end
end
