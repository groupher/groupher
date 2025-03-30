defmodule GroupherServer.Test.Query.Collects.BlogCollect do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community user user2 blog)a}
  end

  describe "[collect users]" do
    test "guest can get collected users list after collect a blog",
         ~m(guest_conn community blog user user2)a do
      {:ok, _} = CMS.collect_article(blog, user)
      {:ok, _} = CMS.collect_article(blog, user2)

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        thread: "BLOG",
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
