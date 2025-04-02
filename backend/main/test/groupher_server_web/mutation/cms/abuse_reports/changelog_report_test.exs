defmodule GroupherServer.Test.Mutation.AbuseReports.ChangelogReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community changelog)a}
  end

  describe "[changelog report/undo_report]" do
    test "login user can report a changelog", ~m(community changelog user_conn)a do
      variables = %{id: changelog.inner_id, community: community.slug, reason: "reason"}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :changelog), variables)
      assert article["id"] == to_string(changelog.id)
    end

    test "login user can undo report a changelog", ~m(community changelog user_conn)a do
      variables = %{id: changelog.inner_id, reason: "reason", community: community.slug}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :changelog), variables)
      assert article["id"] == to_string(changelog.id)

      variables = %{id: changelog.inner_id, community: community.slug}

      article =
        user_conn |> gq_mutation(Schema.m(:undo_report_article, :changelog), variables)

      assert article["id"] == to_string(changelog.id)
    end
  end
end
