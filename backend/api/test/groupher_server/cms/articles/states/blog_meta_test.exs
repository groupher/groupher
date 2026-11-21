defmodule GroupherServer.Test.CMS.BlogMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user community blog_attrs)a}
  end

  describe "[cms blog meta info]" do
    test "can get default meta info", ~m(user community blog_attrs)a do
      {:ok, blog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :blog,
          blog_attrs,
          user
        )

      blog = Repo.get!(CMS.Model.Article, blog.id)
      refute blog.is_edited
      refute blog.comments_locked
    end

    test "is_edited flag should set to true after blog updated",
         ~m(user community blog_attrs)a do
      {:ok, blog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :blog,
          blog_attrs,
          user
        )

      assert not Repo.get!(CMS.Model.Article, blog.id).is_edited

      article = Repo.get!(CMS.Model.Article, blog.id)
      working_copy = Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id)
      public = Repo.get!(CMS.Model.ArticlePublic, article.id)

      assert {:ok, saved} =
               CMS.Articles.save_working_copy(
                 article,
                 community,
                 working_copy.id,
                 %{title: "new title"},
                 working_copy.revision,
                 user,
                 Ecto.UUID.generate()
               )

      CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
        :last_publish_time,
        user,
        minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
      )

      assert {:ok, _published} =
               CMS.Articles.publish_article(
                 article,
                 community,
                 %{working_copy_id: saved.id, revision: saved.revision},
                 public.snapshot_id,
                 user,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(CMS.Model.Article, blog.id).is_edited
    end

    test "blog's lock/undo_lock article should work", ~m(user community blog_attrs)a do
      {:ok, blog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :blog,
          blog_attrs,
          user
        )

      assert not blog.comments_locked

      {:ok, _} = CMS.Articles.lock_comments(blog.id, user, community: community)
      assert Repo.get!(CMS.Model.Article, blog.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(blog.id, user, community: community)
      refute Repo.get!(CMS.Model.Article, blog.id).comments_locked
    end
  end
end
