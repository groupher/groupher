defmodule GroupherServer.Test.Query.Accounts.Published.Blogs do
  @moduledoc false

  use GroupherServer.TestTools

  @publish_count 10

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn community blog user)a}
  end

  describe "[published blogs]" do
    test "can get published blogs", ~m(guest_conn community user)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      {:ok, blog2} = CMS.create_article(community, :blog, blog_attrs, user)

      variables = %{login: user.login, filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_published_articles, :blog), variables)

      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(blog.inner_id)))
      assert results["entries"] |> Enum.any?(&(&1["innerId"] == to_string(blog2.inner_id)))
    end
  end

  describe "[account published comments on blog]" do
    test "user can get paged published comments on blog", ~m(guest_conn user community blog)a do
      pub_comments =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          {:ok, comment} =
            CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

          acc ++ [comment]
        end)

      random_comment_id = pub_comments |> Enum.random() |> Map.get(:id) |> to_string

      variables = %{login: user.login, thread: "BLOG", filter: %{page: 1, size: 20}}
      results = guest_conn |> gq_query(Schema.q(:paged_published_comments), variables)

      entries = results["entries"]
      assert results |> is_valid_pagination?
      assert results["totalCount"] == @publish_count

      assert entries |> Enum.all?(&(not is_nil(&1["article"]["author"])))

      assert entries |> Enum.all?(&(&1["article"]["id"] == to_string(blog.id)))
      assert entries |> Enum.all?(&(&1["author"]["id"] == to_string(user.id)))
      assert entries |> Enum.any?(&(&1["id"] == random_comment_id))
    end
  end
end
