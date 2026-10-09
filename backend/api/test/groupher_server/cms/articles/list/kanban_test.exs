defmodule GroupherServer.Test.CMS.Articles.Kanban do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @article_cat CMS.Artiment.Const.cat_map()
  @article_status CMS.Artiment.Const.status_map()

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community post post_attrs)a}
  end

  describe "[cms kanban curd]" do
    test "can create kanban post should have default cat & status",
         ~m(user2 community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      kanban_attrs = post_attrs

      {:ok, kanban} = CMS.Articles.create(community, :post, kanban_attrs, user2)

      assert kanban.cat == nil
      assert kanban.status == nil
    end

    test "can set cat of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, post} =
        CMS.Articles.set_cat(kanban.article_id, @article_cat.idea, user, community.id)

      state = Repo.get!(CMS.Model.PostState, post.id)

      assert state.cat == @article_cat.idea
    end

    test "can set status of a post", ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, post} =
        CMS.Articles.set_status(kanban.article_id, @article_status.todo, user, community.id)

      binding =
        Repo.get_by!(CMS.Model.ArticleBinding,
          article_id: post.id,
          community_id: community.id
        )

      state = Repo.get!(CMS.Model.KanbanState, binding.id)

      assert state.status == @article_status.todo
    end

    test "kanban status is scoped to each ArticleBinding placement",
         ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, mirror_community} = mock_community(user)

      assert {:ok, _binding} =
               CMS.Articles.mirror(
                 mirror_community,
                 kanban.article_id,
                 [],
                 user,
                 community,
                 Ecto.UUID.generate()
               )

      {:ok, article} = CMS.FrontDesk.article(kanban.article_id, mode: :internal)

      assert {:ok, _} =
               CMS.Kanban.add_post(community, article, @article_status.todo, user)

      assert {:ok, _} =
               CMS.Kanban.add_post(
                 mirror_community,
                 article,
                 @article_status.todo,
                 user
               )

      assert {:ok, _} =
               CMS.Kanban.move_post(
                 mirror_community,
                 article,
                 @article_status.done,
                 user
               )

      source_binding =
        Repo.get_by!(CMS.Model.ArticleBinding,
          article_id: kanban.article_id,
          community_id: community.id
        )

      mirror_binding =
        Repo.get_by!(CMS.Model.ArticleBinding,
          article_id: kanban.article_id,
          community_id: mirror_community.id
        )

      assert Repo.get!(CMS.Model.KanbanState, source_binding.id).status == @article_status.todo
      assert Repo.get!(CMS.Model.KanbanState, mirror_binding.id).status == @article_status.done
    end

    test "can remove a post from one Community-local Kanban",
         ~m(user community post_attrs)a do
      {:ok, kanban} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, article} = CMS.FrontDesk.article(kanban.article_id, mode: :internal)

      assert {:ok, _} = CMS.Kanban.add_post(community, article, @article_status.todo, user)
      assert {:ok, _} = CMS.Kanban.remove_post(community, article, user)

      binding =
        Repo.get_by!(CMS.Model.ArticleBinding,
          article_id: kanban.article_id,
          community_id: community.id
        )

      refute Repo.get(CMS.Model.KanbanState, binding.id)

      assert {:error, %GroupherServer.ErrorCat.Error{reason: :not_in_kanban}} =
               CMS.Kanban.move_post(community, article, @article_status.done, user)
    end

    test "can create kanban post with valid attrs", ~m(user2 community post_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.done})

      {:ok, kanban} = CMS.Articles.create(community, :post, kanban_attrs, user2)

      assert kanban.cat == @article_cat.idea
      assert kanban.status == @article_status.done
    end

    test "can get paged kanban posts", ~m(user community post_attrs)a do
      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.todo})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.wip})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.done})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.reject})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.reject_dup})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      {:ok, paged_backlog_posts} =
        CMS.Articles.paged_kanban(community, %{status: @article_status.backlog, page: 1, size: 20})

      {:ok, paged_todo_posts} =
        CMS.Articles.paged_kanban(community, %{status: @article_status.todo, page: 1, size: 20})

      {:ok, paged_wip_posts} =
        CMS.Articles.paged_kanban(community, %{status: @article_status.wip, page: 1, size: 20})

      {:ok, paged_done_posts} =
        CMS.Articles.paged_kanban(community, %{status: @article_status.done, page: 1, size: 20})

      {:ok, paged_rejected_posts} =
        CMS.Articles.paged_kanban(community, %{
          status: [@article_status.reject, @article_status.reject_dup],
          page: 1,
          size: 20
        })

      assert paged_backlog_posts |> is_valid_pagination?(:raw)
      assert paged_todo_posts |> is_valid_pagination?(:raw)
      assert paged_wip_posts |> is_valid_pagination?(:raw)
      assert paged_done_posts |> is_valid_pagination?(:raw)
      assert paged_rejected_posts |> is_valid_pagination?(:raw)

      assert paged_backlog_posts.entries
             |> Enum.filter(&(&1.status == @article_status.backlog))
             |> length == 1

      assert paged_todo_posts.entries
             |> Enum.filter(&(&1.status == @article_status.todo))
             |> length == 2

      assert paged_wip_posts.entries
             |> Enum.filter(&(&1.status == @article_status.wip))
             |> length == 1

      assert paged_done_posts.entries
             |> Enum.filter(&(&1.status == @article_status.done))
             |> length == 2

      assert paged_rejected_posts.entries
             |> Enum.filter(&(&1.status in [@article_status.reject, @article_status.reject_dup]))
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
             |> Enum.filter(&(&1.status == @article_status.backlog))
             |> length == 0

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.status == @article_status.todo))
             |> length == 0

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.status == @article_status.wip))
             |> length == 0

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.status == @article_status.done))
             |> length == 0

      assert grouped_kanban_posts.rejected.entries
             |> Enum.filter(&(&1.status in [@article_status.reject, @article_status.reject_dup]))
             |> length == 0
    end

    test "can get grouped kanban posts", ~m(user community post_attrs)a do
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

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.todo})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.wip})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.done})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.reject})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      kanban_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.reject_dup})

      {:ok, _} = CMS.Articles.create(community, :post, kanban_attrs, user)

      {:ok, grouped_kanban_posts} = CMS.Articles.grouped_kanban(community)

      assert grouped_kanban_posts.backlog |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.todo |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.wip |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.done |> is_valid_pagination?(:raw)
      assert grouped_kanban_posts.rejected |> is_valid_pagination?(:raw)

      assert grouped_kanban_posts.backlog.entries
             |> Enum.filter(&(&1.status == @article_status.backlog))
             |> length == 1

      assert grouped_kanban_posts.todo.entries
             |> Enum.filter(&(&1.status == @article_status.todo))
             |> length == 2

      assert grouped_kanban_posts.wip.entries
             |> Enum.filter(&(&1.status == @article_status.wip))
             |> length == 1

      assert grouped_kanban_posts.done.entries
             |> Enum.filter(&(&1.status == @article_status.done))
             |> length == 2

      assert grouped_kanban_posts.rejected.entries
             |> Enum.filter(&(&1.status in [@article_status.reject, @article_status.reject_dup]))
             |> length == 2
    end

    test "disabled grouped kanban boards return empty paginations",
         ~m(user community post_attrs)a do
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

      backlog_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.backlog})

      {:ok, _} = CMS.Articles.create(community, :post, backlog_attrs, user)

      todo_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.todo})

      {:ok, _} = CMS.Articles.create(community, :post, todo_attrs, user)

      rejected_attrs =
        post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.reject})

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
