defmodule GroupherServer.Test.Query.PagedArticles.PagedKanbanPosts do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @article_cat CMS.Artiment.Const.cat_map()
  @article_status CMS.Artiment.Const.status_map()

  setup do
    {community, _, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user community post_attrs)a}
  end

  describe "[query paged_posts filter pagination]" do
    @query S.Article.q(:grouped_kanban_posts)
    test "should get grouped paged posts", ~m(guest_conn user community post_attrs)a do
      {:ok, _} =
        CMS.Dashboard.update(
          community,
          :layout,
          %{
            kanban_boards: [:backlog, :todo, :wip, :done, :rejected]
          },
          user,
          Ecto.UUID.generate()
        )

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      set_post_state(post, @article_cat.idea, @article_status.backlog, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      set_post_state(post, @article_cat.idea, @article_status.todo, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.bug, @article_status.wip, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.idea, @article_status.done, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.bug, @article_status.reject_dup, user, community)

      variables = %{community: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert results["backlog"] |> is_valid_pagination?
      assert results["backlog"]["totalCount"] == 1

      assert results["todo"] |> is_valid_pagination?
      assert results["todo"]["totalCount"] == 1

      assert results["wip"] |> is_valid_pagination?
      assert results["wip"]["totalCount"] == 1

      assert results["done"] |> is_valid_pagination?
      assert results["done"]["totalCount"] == 1

      assert results["rejected"] |> is_valid_pagination?
      assert results["rejected"]["totalCount"] == 1
    end

    test "disabled grouped kanban boards resolve to empty paginations",
         ~m(guest_conn user community post_attrs)a do
      {:ok, _} =
        CMS.Dashboard.update(
          community,
          :layout,
          %{
            kanban_boards: [:todo, :wip, :done]
          },
          user,
          Ecto.UUID.generate()
        )

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.idea, @article_status.backlog, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.idea, @article_status.todo, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.bug, @article_status.reject_dup, user, community)

      variables = %{community: community.slug}
      results = guest_conn |> gq_query(@query, variables)

      assert results["backlog"] |> is_valid_pagination?
      assert results["backlog"]["totalCount"] == 0

      assert results["todo"] |> is_valid_pagination?
      assert results["todo"]["totalCount"] == 1

      assert results["rejected"] |> is_valid_pagination?
      assert results["rejected"]["totalCount"] == 0
    end

    @query S.Article.q(:paged_kanban_posts)
    test "can get paged kanban posts", ~m(guest_conn user community post_attrs)a do
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.idea, @article_status.todo, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.bug, @article_status.wip, user, community)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      set_post_state(post, @article_cat.idea, @article_status.done, user, community)

      variables = %{
        community: community.slug,
        filter: %{page: 1, size: 20, status: "WIP"}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.at(0) |> Map.get("status") == "WIP"
    end
  end

  defp set_post_state(post, cat, status, user, community) do
    assert {:ok, _} = CMS.Articles.set_cat(post.id, cat, user, community.id)
    assert {:ok, _} = CMS.Articles.set_status(post.id, status, user, community.id)
  end
end
