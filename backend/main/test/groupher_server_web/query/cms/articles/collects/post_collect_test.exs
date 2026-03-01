defmodule GroupherServer.Test.Query.Collects.PostCollect do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community user user2 post)a}
  end

  describe "[collect users]" do
    test "guest can get collected users list after collect a post",
         ~m(guest_conn community post user user2)a do
      {:ok, _} = CMS.Articles.collect(post, user)
      {:ok, _} = CMS.Articles.collect(post, user2)

      variables = %{article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"}, filter: %{page: 1, size: 20}}

      results =
        guest_conn |> gq_query(Schema.q(:collected_users), variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 2

      assert user_exist_in?(user, results["entries"])
      assert user_exist_in?(user2, results["entries"])
    end
  end
end
