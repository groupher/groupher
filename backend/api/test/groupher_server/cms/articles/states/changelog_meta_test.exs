defmodule GroupherServer.Test.CMS.ChangelogMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user community changelog_attrs)a}
  end

  describe "[cms changelog meta info]" do
    test "can get default meta info", ~m(user community changelog_attrs)a do
      {:ok, changelog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :changelog,
          changelog_attrs,
          user
        )

      changelog = Repo.get!(CMS.Model.Article, changelog.id)
      refute changelog.is_edited
      refute changelog.comments_locked
    end

    test "is_edited flag should set to true after changelog updated",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :changelog,
          changelog_attrs,
          user
        )

      assert not Repo.get!(CMS.Model.Article, changelog.id).is_edited

      article = Repo.get!(CMS.Model.Article, changelog.id)
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

      assert saved.title == "new title"

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

      assert Repo.get!(CMS.Model.Article, changelog.id).is_edited
    end

    test "changelog's lock/undo_lock article should work", ~m(user community changelog_attrs)a do
      {:ok, changelog} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :changelog,
          changelog_attrs,
          user
        )

      assert not changelog.meta.is_comment_locked

      {:ok, _} = CMS.Articles.lock_comments(changelog.id, user, community: community)
      assert Repo.get!(CMS.Model.Article, changelog.id).comments_locked

      {:ok, _} = CMS.Articles.undo_lock_comments(changelog.id, user, community: community)
      refute Repo.get!(CMS.Model.Article, changelog.id).comments_locked
    end
  end
end
