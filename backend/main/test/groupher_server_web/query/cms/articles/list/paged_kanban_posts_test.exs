defmodule GroupherServer.Test.Query.PagedArticles.PagedKanbanPosts do
  @moduledoc false

  use GroupherServer.TestMate

  @article_cat GroupherServer.CMS.Artiment.Const.cat_map()
  @article_status GroupherServer.CMS.Artiment.Const.status_map()

  setup do
    {community, _, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn user community post_attrs)a}
  end

  describe "[query paged_posts filter pagination]" do
    @query S.Article.q(:grouped_kanban_posts)
    test "should get grouped paged posts", ~m(guest_conn user community post_attrs)a do
      {:ok, _} =
        CMS.Dashboard.update(community, :layout, %{
          kanban_boards: [:backlog, :todo, :wip, :done, :rejected]
        })

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.backlog)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.todo)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.wip)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.done)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.reject_dup)

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
        CMS.Dashboard.update(community, :layout, %{
          kanban_boards: [:todo, :wip, :done]
        })

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.backlog)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.todo)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.reject_dup)

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
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.todo)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.bug)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.wip)

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)
      {:ok, _} = CMS.Articles.set_status(post, @article_status.done)

      variables = %{
        community: community.slug,
        filter: %{page: 1, size: 20, status: "WIP"}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["totalCount"] == 1
      assert results["entries"] |> Enum.at(0) |> Map.get("status") == "WIP"
    end
  end
end
