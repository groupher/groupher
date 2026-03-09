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
      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}, reason: "reason"}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :changelog), variables)
      assert article["innerId"] == to_string(changelog.inner_id)
    end

    test "login user can undo report a changelog", ~m(community changelog user_conn)a do
      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}, reason: "reason"}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :changelog), variables)
      assert article["innerId"] == to_string(changelog.inner_id)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug}}

      article =
        user_conn |> gq_mutation(Schema.m(:undo_report_article, :changelog), variables)

      assert article["innerId"] == to_string(changelog.inner_id)
    end
  end
end
