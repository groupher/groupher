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
      variables = %{
        article: %{inner_id: article_inner_id(post, community), community: community.slug, thread: "POST"},
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :post), variables)

      assert article["innerId"] == to_string(article_inner_id(post, community))
    end

    test "login user can undo report a post", ~m(community post user_conn)a do
      variables = %{
        article: %{inner_id: article_inner_id(post, community), community: community.slug, thread: "POST"},
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :post), variables)

      assert article["innerId"] == to_string(article_inner_id(post, community))

      variables = %{
        article: %{inner_id: article_inner_id(post, community), community: community.slug, thread: "POST"}
      }

      article = user_conn |> gq_mutation(S.Article.m(:undo_report_article, :post), variables)
      assert article["innerId"] == to_string(article_inner_id(post, community))
    end
  end
end
