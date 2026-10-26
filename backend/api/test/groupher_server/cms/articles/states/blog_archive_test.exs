defmodule GroupherServer.Test.CMS.BlogArchive do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {_community, article_view, _attrs, _author} = mock_article(:blog, community, user)
    blog_long_ago = Repo.get!(CMS.Model.Article, article_view.id)

    {:ok, blog_long_ago} =
      blog_long_ago |> Ecto.Changeset.change(active_at: @last_year) |> Repo.update()

    db_insert_multi(:blog, 5)

    {:ok, ~m(user community blog_long_ago)a}
  end

  describe "[cms blog archive]" do
    test "rechecks the threshold and returns tagged archive counts", ~m(blog_long_ago)a do
      now = DateTime.utc_now(:second)
      threshold = DateTime.add(now, -86_400, :second)

      blog_long_ago
      |> Ecto.Changeset.change(active_at: now)
      |> Repo.update!()

      assert {:ok, 0} = CMS.Articles.Lifecycle.archive_before(:blog, threshold)

      blog_long_ago
      |> Ecto.Changeset.change(active_at: DateTime.add(threshold, -1, :second))
      |> Repo.update!()

      assert {:ok, 1} = CMS.Articles.Lifecycle.archive_before(:blog, threshold)
      assert {:ok, 0} = CMS.Articles.Lifecycle.archive_before(:blog, threshold)
    end

    test "skips a candidate refreshed while the archive worker waits for its row lock",
         ~m(blog_long_ago)a do
      now = DateTime.utc_now(:second)
      threshold = DateTime.add(now, -86_400, :second)
      stale_at = DateTime.add(threshold, -1, :second)

      blog_long_ago
      |> Ecto.Changeset.change(active_at: stale_at)
      |> Repo.update!()

      parent = self()

      refresh =
        Task.async(fn ->
          Repo.transaction(fn ->
            locked =
              CMS.Model.Article
              |> where([article], article.id == ^blog_long_ago.id)
              |> lock("FOR UPDATE")
              |> Repo.one!()

            send(parent, :article_locked)

            receive do
              :refresh_article ->
                locked
                |> Ecto.Changeset.change(active_at: now)
                |> Repo.update!()
            end
          end)
        end)

      assert_receive :article_locked

      archive =
        Task.async(fn -> CMS.Articles.Lifecycle.archive_before(:blog, threshold) end)

      assert Task.yield(archive, 100) == nil
      send(refresh.pid, :refresh_article)
      assert {:ok, {:ok, _article}} = Task.yield(refresh, 5_000)
      assert {:ok, {:ok, 0}} = Task.yield(archive, 5_000)
    end

    test "can archive blogs", ~m(blog_long_ago)a do
      {:ok, _} = CMS.Articles.Maintenance.archive(:blog)

      archived_blogs = archived_articles(:blog)

      assert length(archived_blogs) == 1
      archived_blog = archived_blogs |> List.first()
      assert archived_blog.id == blog_long_ago.id
    end

    test "can not edit archived blog", ~m(community user)a do
      {:ok, _} = CMS.Articles.Maintenance.archive(:blog)

      archived_blogs = archived_articles(:blog)

      archived_blog = archived_blogs |> List.first()

      {:error, reason} =
        CMS.Articles.update(
          Map.put(archived_blog, :community, community),
          %{"title" => "new title"},
          user,
          Ecto.UUID.generate()
        )

      assert %ErrorCat.Error{reason: :article_archived} = reason
    end

    test "can not delete archived blog", ~m(community)a do
      {:ok, _} = CMS.Articles.Maintenance.archive(:blog)

      archived_blogs = archived_articles(:blog)

      archived_blog = archived_blogs |> List.first()

      {:error, reason} =
        CMS.Articles.Maintenance.trash(archived_blog, community: community)

      assert %ErrorCat.Error{reason: :article_archived} = reason
    end
  end

  defp archived_articles(thread) do
    CMS.Model.Article
    |> join(:inner, [article], lifecycle in CMS.Model.ArticleLifecycle,
      on: lifecycle.article_id == article.id
    )
    |> where([article, lifecycle], article.thread == ^thread and lifecycle.state == :archived)
    |> Repo.all()
  end
end
