defmodule GroupherServer.Test.CMS.PostMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user community post_attrs)a}
  end

  describe "[cms post meta info]" do
    test "can get default meta info", ~m(user community post_attrs)a do
      {:ok, post} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :post,
          post_attrs,
          user
        )

      post = Repo.get!(CMS.Model.Article, post.id)
      refute post.is_edited
      refute post.comments_locked
      refute post.is_sunk
    end

    test "is_edited flag should set to true after post updated", ~m(user community post_attrs)a do
      {:ok, post} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :post,
          post_attrs,
          user
        )

      assert not Repo.get!(CMS.Model.Article, post.id).is_edited

      article = Repo.get!(CMS.Model.Article, post.id)
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

      assert Repo.get!(CMS.Model.Article, post.id).is_edited
    end

    test "post's lock/undo_lock article should work", ~m(user community post_attrs)a do
      {:ok, post} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :post,
          post_attrs,
          user
        )

      assert not post.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(post.id, user, community: community)
      assert Repo.get!(CMS.Model.Article, post.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(post.id, user, community: community)
      refute Repo.get!(CMS.Model.Article, post.id).comments_locked
    end
  end
end
