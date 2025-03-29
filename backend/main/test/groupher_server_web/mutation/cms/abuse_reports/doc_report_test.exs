defmodule GroupherServer.Test.Mutation.AbuseReports.DocReport do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community doc)a}
  end

  describe "[doc report/undo_report]" do
    @tag :wip
    test "login user can report a doc", ~m(community doc user user_conn)a do
      variables = %{id: doc.inner_id, community: community.slug, reason: "reason"}

      article =
        user_conn
        |> gq_mutation(Schema.m(:report_article, :doc), variables)

      assert article["id"] == to_string(doc.id)
    end

    @tag :wip
    test "login user can undo report a doc", ~m(community doc user user_conn)a do
      variables = %{id: doc.inner_id, reason: "reason", community: community.slug}

      article = user_conn |> gq_mutation(Schema.m(:report_article, :doc), variables)

      assert article["id"] == to_string(doc.id)

      variables = %{id: doc.inner_id, community: community.slug}

      article = user_conn |> gq_mutation(Schema.m(:undo_report_article, :doc), variables)
      assert article["id"] == to_string(doc.id)
    end
  end
end
