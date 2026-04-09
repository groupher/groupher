defmodule GroupherServer.Test.CMS.Articles.Kanban do
  @moduledoc false

  use GroupherServer.TestMate

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community post post_attrs)a}
  end

  describe "[cms kanban curd]" do
    test "can create kanban post should have default cat & state",
         ~m(user2 community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      kanban_attrs = post_attrs

      {:ok, kanban} = CMS.Articles.create(community, :post, kanban_attrs, user2)

      assert kanban.cat == nil
      assert kanban.state == nil
    end

    test "can set cat of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post} = CMS.Articles.set_cat(kanban, @article_cat.feature)

      assert post.cat == @article_cat.feature
    end

    test "can set state of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, post} = CMS.Articles.set_state(kanban, @article_state.todo)

      assert post.state == @article_state.todo
    end

    test "can create kanban post with valid attrs", ~m(user2 community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, kanban} = CMS.Articles.create(community, :post, kanban_attrs, user2)

      assert kanban.cat == @article_cat.feature
      assert kanban.state == @article_state.done
    end

    test "can get paged kanban posts", ~m(user community post_attrs)a do
      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.wip})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.reject})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.reject_dup})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      {:ok, paged_backlog_posts} =
        CMS.Articles.paged_kanban(community, %{state: @article_state.backlog, page: 1, size: 20})

      {:ok, paged_todo_posts} =
        CMS.Articles.paged_kanban(community, %{state: @article_state.todo, page: 1, size: 20})

      {:ok, paged_wip_posts} =
        CMS.Articles.paged_kanban(community, %{state: @article_state.wip, page: 1, size: 20})

      {:ok, paged_done_posts} =
        CMS.Articles.paged_kanban(community, %{state: @article_state.done, page: 1, size: 20})

      {:ok, paged_rejected_posts} =
        CMS.Articles.paged_kanban(community, %{
          state: [@article_state.reject, @article_state.reject_dup],
          page: 1,
          size: 20
        })

      assert paged_backlog_posts |> is_valid_pagination?(:raw)
      assert paged_todo_posts |> is_valid_pagination?(:raw)
      assert paged_wip_posts |> is_valid_pagination?(:raw)
      assert paged_done_posts |> is_valid_pagination?(:raw)
      assert paged_rejected_posts |> is_valid_pagination?(:raw)

      assert paged_backlog_posts.entries
             |> Enum.filter(&(&1.state == @article_state.backlog))
             |> length == 1

      assert paged_todo_posts.entries
             |> Enum.filter(&(&1.state == @article_state.todo))
             |> length == 2

      assert paged_wip_posts.entries
             |> Enum.filter(&(&1.state == @article_state.wip))
             |> length == 1

      assert paged_done_posts.entries
             |> Enum.filter(&(&1.state == @article_state.done))
             |> length == 2

      assert paged_rejected_posts.entries
             |> Enum.filter(&(&1.state in [@article_state.reject, @article_state.reject_dup]))
             |> length == 2
    end

    test "can get default empty grouped kanban posts", ~m(community)a do
      {:ok, grouped_kanban_posts} = CMS.Articles.grouped_kanban(community)

      assert grouped_kanban_posts.backlog |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.wip |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.done |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.rejected |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.backlog.entries
             |> Enum.filter(&(&1.state == @article_state.backlog))
             |> length == 0

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.state == @article_state.todo))
             |> length == 0

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.state == @article_state.wip))
             |> length == 0

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.state == @article_state.done))
             |> length == 0

      assert grouped_kanban_posts.rejected.entries
             |> Enum.filter(&(&1.state in [@article_state.reject, @article_state.reject_dup]))
             |> length == 0
    end

    test "can get grouped kanban posts", ~m(user community post_attrs)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :layout, %{
          kanban_boards: [:backlog, :todo, :wip, :done, :rejected]
        })

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.wip})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.done})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.reject})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.reject_dup})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      {:ok, grouped_kanban_posts} = CMS.Articles.grouped_kanban(community)

      assert grouped_kanban_posts.backlog |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.wip |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.done |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.rejected |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.backlog.entries
             |> Enum.filter(&(&1.state == @article_state.backlog))
             |> length == 1

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.state == @article_state.todo))
             |> length == 2

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.state == @article_state.wip))
             |> length == 1

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.state == @article_state.done))
             |> length == 2

      assert grouped_kanban_posts.rejected.entries
             |> Enum.filter(&(&1.state in [@article_state.reject, @article_state.reject_dup]))
             |> length == 2
    end

    test "disabled grouped kanban boards return empty paginations", ~m(user community post_attrs)a do
      {:ok, _} =
        CMS.Communities.update_dashboard(community, :layout, %{kanban_boards: [:todo, :wip, :done]})

      backlog_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, backlog_attrs, user)

      todo_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

      {:ok, _} = CMS.Articles.create(community, :post, todo_attrs, user)

      rejected_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.reject})

      {:ok, _} = CMS.Articles.create(community, :post, rejected_attrs, user)

      {:ok, grouped_kanban_posts} = CMS.Articles.grouped_kanban(community)

      assert grouped_kanban_posts.backlog |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.rejected |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.backlog.total_count == 0
      assert grouped_kanban_posts.backlog.entries == []

      assert grouped_kanban_posts.rejected.total_count == 0
      assert grouped_kanban_posts.rejected.entries == []

      assert grouped_kanban_posts.todo.total_count == 1
    end
  end
end
