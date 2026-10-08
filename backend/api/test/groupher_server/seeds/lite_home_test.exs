defmodule GroupherServer.Test.Seeds.LiteHomeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  @moduletag timeout: 300_000

  alias GroupherServer.CMS
  alias CMS.Seeds.LiteHome
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, KanbanState}

  describe "[lite home seeds]" do
    test "resets home with minimal main and dashboard data" do
      {:ok, seeded_community} = LiteHome.reset_and_seed()
      {:ok, community} = ORM.find(Community, seeded_community.id, preload: :dashboard)

      assert community.slug == "home"
      assert community.dashboard.enable.post == true
      assert community.dashboard.enable.kanban == true
      assert community.dashboard.enable.changelog == true
      assert community.dashboard.enable.doc == false

      assert count(:post, community.id) == 4
      assert count(:changelog, community.id) == 3
      assert count(:doc, community.id) == 0
      assert seeded_community.seed_summary.kanban_posts == 4

      kanban_posts =
        Repo.all(
          from(article in Article,
            join: binding in ArticleBinding,
            on: binding.article_id == article.id,
            join: state in KanbanState,
            on: state.article_binding_id == binding.id,
            where:
              binding.community_id == ^community.id and article.thread == :post and
                not is_nil(state.status),
            select: state
          )
        )

      assert length(kanban_posts) == 4
      assert Enum.sort(Enum.map(kanban_posts, & &1.status)) == [:backlog, :done, :todo, :wip]

      assert {:ok, %{todo: %{entries: [_ | _]}}} = CMS.Articles.grouped_kanban(community)

      post = article_by_title!(community.id, "一次线上故障复盘记录")

      {1, _} =
        from(state in KanbanState,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          where: binding.article_id == ^post.id and binding.community_id == ^community.id
        )
        |> Repo.delete_all()

      assert kanban_count(community.id) == 3

      {:ok, community} = LiteHome.seed()

      assert count(:post, community.id) == 4
      assert count(:changelog, community.id) == 3
      assert count(:doc, community.id) == 0
      assert count(:post, community.id) == community.seed_summary.posts
      assert kanban_count(community.id) == 4
      assert community.seed_summary.kanban_posts == 4

      post = article_by_title!(community.id, "一次线上故障复盘记录")

      assert {:ok, _trash_item} = CMS.Articles.trash(post, :operations, community: community)
      assert count(:post, community.id) == 3

      {:ok, community} = LiteHome.seed()

      assert count(:post, community.id) == 4
      assert community.seed_summary.posts == 4
    end
  end

  defp kanban_count(community_id) do
    Article
    |> join(:inner, [article], binding in ArticleBinding, on: binding.article_id == article.id)
    |> join(:inner, [article], lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.state in [:published, :archived]
    )
    |> join(:inner, [article, binding], state in KanbanState,
      on: state.article_binding_id == binding.id
    )
    |> where(
      [article, binding],
      article.thread == :post and binding.community_id == ^community_id
    )
    |> Repo.aggregate(:count, :id)
  end

  defp count(thread, community_id) do
    Article
    |> join(:inner, [article], binding in ArticleBinding, on: binding.article_id == article.id)
    |> join(:inner, [article], lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.state in [:published, :archived]
    )
    |> where(
      [article, binding],
      article.thread == ^thread and binding.community_id == ^community_id
    )
    |> Repo.aggregate(:count, :id)
  end

  defp article_by_title!(community_id, title) do
    Article
    |> join(:inner, [article], binding in CMS.Model.ArticleBinding,
      on: binding.article_id == article.id
    )
    |> join(:inner, [article], public in CMS.Model.ArticlePublic,
      on: public.article_id == article.id
    )
    |> where(
      [article, binding, public],
      binding.community_id == ^community_id and article.thread == :post and public.title == ^title
    )
    |> Repo.one!()
  end
end
