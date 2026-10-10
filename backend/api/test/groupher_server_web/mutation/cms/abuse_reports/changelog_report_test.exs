defmodule GroupherServer.Test.Mutation.AbuseReports.ChangelogReport do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog)a}
  end

  describe "[changelog report/undo_report]" do
    test "login user can report a changelog", ~m(community changelog user_conn)a do
      variables = %{
        command_id: Ecto.UUID.generate(),
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :changelog), variables)
      assert article["innerId"] == to_string(article_inner_id(changelog, community))
    end

    test "login user can undo report a changelog", ~m(community changelog user_conn)a do
      variables = %{
        command_id: Ecto.UUID.generate(),
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        reason: "reason"
      }

      article = user_conn |> gq_mutation(S.Article.m(:report_article, :changelog), variables)
      assert article["innerId"] == to_string(article_inner_id(changelog, community))

      variables = %{
        command_id: Ecto.UUID.generate(),
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        }
      }

      article =
        user_conn |> gq_mutation(S.Article.m(:undo_report_article, :changelog), variables)

      assert article["innerId"] == to_string(article_inner_id(changelog, community))
    end
  end
end
