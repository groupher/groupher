defmodule GroupherServer.Test.Seeds.FullCommunityTest do
  @moduledoc false
  use GroupherServer.TestTools

  describe "[full community seeds]" do
    test "seeds full community data including about dashboard" do
      slug = "seed-full-#{System.unique_integer([:positive, :monotonic])}"

      {:ok, community} = CMS.Seeds.full_community(slug)

      {:ok, community} = ORM.find(Community, community.id, preload: [:dashboard, threads: :thread])

      thread_slugs = Enum.map(community.threads, & &1.thread.slug)
      assert Enum.all?(["post", "changelog", "kanban", "doc", "about"], &(&1 in thread_slugs))

      post_count = from(p in Post, where: p.community_id == ^community.id) |> Repo.aggregate(:count, :id)

      changelog_count =
        from(p in Changelog, where: p.community_id == ^community.id) |> Repo.aggregate(:count, :id)

      doc_count = from(p in Doc, where: p.community_id == ^community.id) |> Repo.aggregate(:count, :id)

      assert post_count == 23
      assert changelog_count == 23
      assert doc_count == 23

      post = Repo.one!(from(p in Post, where: p.community_id == ^community.id, limit: 1))
      assert post.state in [:todo, :wip, :done]

      comments_count = from(c in Comment, where: c.post_id == ^post.id) |> Repo.aggregate(:count, :id)
      assert comments_count >= 23

      dashboard = community.dashboard
      assert dashboard.base_info.homepage != ""
      assert dashboard.base_info.techstack != ""
      assert dashboard.base_info.city != ""
      assert length(dashboard.social_links) > 0
      assert length(dashboard.media_reports) > 0
      assert dashboard.enable.about == true
      assert dashboard.enable.about_techstack == true
      assert dashboard.enable.about_location == true
      assert dashboard.enable.about_links == true
      assert dashboard.enable.about_media_report == true
    end
  end
end
