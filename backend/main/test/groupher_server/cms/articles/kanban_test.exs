defmodule GroupherServer.Test.CMS.Articles.Kanban do
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias Helper.{Constant, ORM}

  alias CMS.Model.Author

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, post} = db_insert(:post)
    {:ok, community} = db_insert(:community)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user user2 community post post_attrs)a}
  end

  describe "[cms kanban curd]" do
    test "can create kanban post should have default cat & state",
         ~m(user community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      kanban_attrs = post_attrs

      {:ok, kanban} = CMS.create_article(community, :post, kanban_attrs, user)

      assert kanban.cat == nil
      assert kanban.state == nil
    end

    test "can set cat of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, post} = CMS.set_post_cat(kanban, @article_cat.feature)

      assert post.cat == "FEATURE"
    end

    test "can set state of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, post} = CMS.set_post_state(kanban, @article_state.todo)

      assert post.state == "TODO"
    end

    test "can create kanban post with valid attrs", ~m(user community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, kanban} = CMS.create_article(community, :post, kanban_attrs, user)

      assert kanban.cat == @article_cat.feature
      assert kanban.state == @article_state.done
    end

    test "can get paged kanban posts", ~m(user community post_attrs)a do
      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.wip})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      {:ok, paged_todo_posts} =
        CMS.paged_kanban_posts(community.slug, %{state: @article_state.todo, page: 1, size: 20})

      {:ok, paged_wip_posts} =
        CMS.paged_kanban_posts(community.slug, %{state: @article_state.wip, page: 1, size: 20})

      {:ok, paged_done_posts} =
        CMS.paged_kanban_posts(community.slug, %{state: @article_state.done, page: 1, size: 20})

      assert paged_todo_posts |> is_valid_pagination?(:raw)
      assert paged_wip_posts |> is_valid_pagination?(:raw)
      assert paged_done_posts |> is_valid_pagination?(:raw)

      assert paged_todo_posts.entries
             |> Enum.filter(&(&1.state == "TODO"))
             |> length == 2

      assert paged_wip_posts.entries
             |> Enum.filter(&(&1.state == "WIP"))
             |> length == 1

      assert paged_done_posts.entries
             |> Enum.filter(&(&1.state == "DONE"))
             |> length == 2
    end

    test "can get default empty grouped kanban posts", ~m(community)a do
      {:ok, grouped_kanban_posts} = CMS.grouped_kanban_posts(community.slug)

      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.wip |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.done |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.state == "TODO"))
             |> length == 0

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.state == "WIP"))
             |> length == 0

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.state == "DONE"))
             |> length == 0
    end

    test "can get grouped kanban posts", ~m(user community post_attrs)a do
      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.wip})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.create_article(community, :post, kanban_attrs, user)

      {:ok, grouped_kanban_posts} = CMS.grouped_kanban_posts(community.slug)

      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.wip |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.done |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.state == "TODO"))
             |> length == 2

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.state == "WIP"))
             |> length == 1

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.state == "DONE"))
             |> length == 2
    end
  end
end
