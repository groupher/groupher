defmodule GroupherServer.Test.Query.Collects.ChangelogCollect do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community user user2 changelog)a}
  end

  describe "[collect users]" do
    test "guest can get collected users list after collect a changelog",
         ~m(guest_conn community changelog user user2)a do
      {:ok, _} = CMS.Articles.collect(changelog, user)
      {:ok, _} = CMS.Articles.collect(changelog, user2)

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        thread: "CHANGELOG",
        filter: %{page: 1, size: 20}
      }

      results =
        guest_conn |> gq_query(Schema.q(:collected_users), variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2

      assert user_exist_in?(user, results["entries"])
      assert user_exist_in?(user2, results["entries"])
    end
  end
end
