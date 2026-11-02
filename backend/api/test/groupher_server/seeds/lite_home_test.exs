defmodule GroupherServer.Test.Seeds.LiteHomeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  @moduletag timeout: 300_000

  alias GroupherServer.CMS
  alias CMS.Seeds.LiteHome

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBindingTag,
    ArticleLifecycle,
    TicketState
  }

  describe "[lite home seeds]" do
    test "resets home with minimal main and dashboard data" do
      {:ok, seeded_community} = LiteHome.reset_and_seed(wallpaper: false)
      {:ok, community} = ORM.find(Community, seeded_community.id, preload: :dashboard)

      assert community.slug == "home"
      assert community.dashboard.enable.post == true
      assert community.dashboard.enable.kanban == true
      assert community.dashboard.enable.changelog == true
      assert community.dashboard.enable.doc == false

      assert count(:post, community.id) == 4
      assert count(:changelog, community.id) == 3
      assert count(:doc, community.id) == 0
      assert seeded_community.seed_summary.user_tickets == 0

      assert_tag_groups_and_article_tags(community, :post, "一次线上故障复盘记录")

      assert_tag_groups_and_article_tags(
        community,
        :changelog,
        "Cloudflare preview routing enabled"
      )

      assert ticket_count(community.id) == 0

      {:ok, community} = LiteHome.seed(wallpaper: false)

      assert count(:post, community.id) == 4
      assert count(:changelog, community.id) == 3
      assert count(:doc, community.id) == 0
      assert count(:post, community.id) == community.seed_summary.posts
      assert ticket_count(community.id) == 0
      assert community.seed_summary.user_tickets == 0

      post = article_by_title!(community.id, "一次线上故障复盘记录")

      assert {:ok, _trash_item} =
               CMS.Articles.Maintenance.trash(post, community: community)

      assert count(:post, community.id) == 3

      {:ok, community} = LiteHome.seed(wallpaper: false)

      assert count(:post, community.id) == 4
      assert community.seed_summary.posts == 4
    end
  end

  defp ticket_count(community_id) do
    TicketState
    |> join(:inner, [ticket], binding in ArticleBinding,
      on: binding.id == ticket.article_binding_id
    )
    |> join(:inner, [ticket], lifecycle in ArticleLifecycle,
      on:
        lifecycle.article_id == ticket.article_id and lifecycle.thread == :ticket and
          lifecycle.state == :published
    )
    |> where(
      [ticket, binding, _lifecycle],
      ticket.type == :user and binding.community_id == ^community_id
    )
    |> Repo.aggregate(:count, :article_id)
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

  defp article_by_title!(community_id, title, thread \\ :post) do
    Article
    |> join(:inner, [article], binding in CMS.Model.ArticleBinding,
      on: binding.article_id == article.id
    )
    |> join(:inner, [article], public in CMS.Model.ArticlePublic,
      on: public.article_id == article.id
    )
    |> where(
      [article, binding, public],
      binding.community_id == ^community_id and article.thread == ^thread and
        public.title == ^title
    )
    |> Repo.one!()
  end

  defp assert_tag_groups_and_article_tags(community, thread, title) do
    {:ok, groups} =
      CMS.Communities.tag_groups(%{
        community_id: community.id,
        thread: thread,
        page: 1,
        size: 100
      })

    assert length(groups) == 2
    assert Enum.all?(groups, &(&1.tags != []))

    article = article_by_title!(community.id, title, thread)

    assignment_count =
      Repo.aggregate(
        from(assignment in ArticleBindingTag,
          join: binding in ArticleBinding,
          on: binding.id == assignment.article_binding_id,
          where:
            binding.article_id == ^article.id and
              binding.community_id == ^community.id and
              assignment.tag_id in subquery(
                from(tag in CMS.Model.CommunityTag,
                  where: tag.community_id == ^community.id and tag.thread == ^thread,
                  select: tag.id
                )
              )
        ),
        :count,
        :article_binding_id
      )

    assert assignment_count == 3
  end
end
