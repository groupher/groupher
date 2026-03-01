defmodule GroupherServer.Test.Query.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog, preload: [author: :user])
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn user user2 community changelog)a}
  end

  describe "[upvoted users]" do
    test "guest can get upvoted users list after upvote to a changelog",
         ~m(guest_conn community changelog user user2)a do
      {:ok, _} = CMS.Articles.upvote(changelog, user)
      {:ok, _} = CMS.Articles.upvote(changelog, user2)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, filter: %{page: 1, size: 20}}

      results = guest_conn |> gq_query(Schema.q(:upvoted_users), variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2

      assert user_exist_in?(user, results["entries"])
      assert user_exist_in?(user2, results["entries"])
    end
  end
end
