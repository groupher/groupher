defmodule GroupherServer.Test.Seeds.FullCommunityTest do
  @moduledoc false
  use GroupherServerWeb.ConnCase, async: false
  @moduletag timeout: 300_000

  import Ecto.Query, warn: false

  alias GroupherServer.CMS
  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.Metrics.Dashboard
  alias Helper.ORM

  alias CMS.Model.{Changelog, Comment, Community, Doc, Post}

  describe "[full community seeds]" do
    test "seeds full community data including about dashboard" do
      slug = "seed-full-#{System.unique_integer([:positive, :monotonic])}"

      {:ok, community} = CMS.Seeds.full_community(slug)

      {:ok, community} =
        ORM.find(Community, community.id, preload: [:dashboard, threads: :thread])

      thread_slugs = Enum.map(community.threads, & &1.thread.slug)
      assert Enum.all?(["post", "changelog", "kanban", "doc", "about"], &(&1 in thread_slugs))

      post_count =
        from(p in Post, where: p.community_id == ^community.id) |> count()

      changelog_count =
        from(p in Changelog, where: p.community_id == ^community.id) |> count()

      doc_count =
        from(p in Doc, where: p.community_id == ^community.id) |> count()

      assert post_count == 23
      assert changelog_count == 23
      assert doc_count == 23

      post = Repo.one!(from(p in Post, where: p.community_id == ^community.id, limit: 1))
      assert post.state in [:backlog, :todo, :wip, :done, :reject]

      comments_count =
        from(c in Comment, where: c.post_id == ^post.id) |> count()

      assert comments_count >= 23

      assert post.upvotes_count in 10..20

      {:ok, paged_post_tags} =
        CMS.Communities.paged_tags(%{
          page: 1,
          size: 100,
          community_id: community.id,
          thread: "POST"
        })

      assert paged_post_tags.total_count in 10..20

      group_size =
        paged_post_tags.entries
        |> Enum.map(& &1.group)
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()
        |> length()

      assert group_size in 2..3

      top_comment =
        Repo.one!(
          from(c in Comment,
            where: c.post_id == ^post.id and is_nil(c.reply_to_id),
            limit: 1,
            order_by: [asc: c.id]
          )
        )

      assert top_comment.upvotes_count in 5..10

      comment_emotion_total =
        top_comment.emotions
        |> Map.from_struct()
        |> Enum.filter(fn {k, _v} -> String.ends_with?(Atom.to_string(k), "_count") end)
        |> Enum.map(fn {_k, v} -> v end)
        |> Enum.sum()

      assert comment_emotion_total > 0

      reply_count =
        from(c in Comment, where: c.post_id == ^post.id and not is_nil(c.reply_to_id))
        |> count()

      assert reply_count > 0

      dashboard = community.dashboard
      assert dashboard.base_info.homepage != ""
      assert dashboard.base_info.techstack != ""
      assert dashboard.base_info.city != ""
      assert dashboard.layout.kanban_bg_colors == Dashboard.kanban_bg_colors_default()
      assert length(dashboard.social_links) > 0
      assert length(dashboard.media_reports) > 0
      assert dashboard.enable.about == true
      assert dashboard.enable.about_techstack == true
      assert dashboard.enable.about_location == true
      assert dashboard.enable.about_links == true
      assert dashboard.enable.about_media_report == true
    end
  end

  defp count(queryable) do
    {:ok, total_count} = ORM.count(queryable)
    total_count
  end
end
