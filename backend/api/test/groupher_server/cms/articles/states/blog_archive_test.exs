defmodule GroupherServer.Test.CMS.BlogArchive do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, blog_long_ago} = db_insert(:blog, %{title: "last week", inserted_at: @last_year})
    blog_long_ago = Repo.get!(CMS.Model.Article, blog_long_ago.id)

    {:ok, blog_long_ago} =
      blog_long_ago |> Ecto.Changeset.change(active_at: @last_year) |> Repo.update()

    db_insert_multi(:blog, 5)

    {:ok, ~m(user community blog_long_ago)a}
  end

  describe "[cms blog archive]" do
    test "can archive blogs", ~m(blog_long_ago)a do
      {:ok, _} = CMS.Articles.archive(:blog)

      archived_blogs = archived_articles(:blog)

      assert length(archived_blogs) == 1
      archived_blog = archived_blogs |> List.first()
      assert archived_blog.id == blog_long_ago.id
    end

    test "can not edit archived blog", ~m(user)a do
      {:ok, _} = CMS.Articles.archive(:blog)

      archived_blogs = archived_articles(:blog)

      archived_blog = archived_blogs |> List.first()

      {:error, reason} =
        CMS.Articles.update(
          archived_blog,
          %{"title" => "new title"},
          user,
          Ecto.UUID.generate()
        )

      assert %ErrorCat.Error{reason: :article_archived} = reason
    end

    test "can not delete archived blog" do
      {:ok, _} = CMS.Articles.archive(:blog)

      archived_blogs = archived_articles(:blog)

      archived_blog = archived_blogs |> List.first()

      {:error, reason} = CMS.Articles.trash(archived_blog, :operations)
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
