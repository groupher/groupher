defmodule GroupherServer.Test.CMS.Articles.CommentSummaryInitializationTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleStats, ArticlePublic, ArticleWorkingCopy}

  test "PUB-01 first and repeated publication preserve the one Comments owner" do
    for thread <- [:post, :blog, :changelog] do
      {community, view, _, user} = mock_article(thread)
      article = Repo.get!(Article, view.article_id)
      initial = Repo.get_by!(ArticleStats, article_id: article.id)
      assert initial.comments_count == 0
      assert initial.comments_revision == 1
      assert initial.comments_participants == []

      {:ok, _} =
        CMS.Comments.create_comment(
          community,
          thread,
          view.inner_id,
          mock_comment(),
          user,
          Ecto.UUID.generate()
        )

      before = Repo.get_by!(ArticleStats, article_id: article.id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_kind: :default)
      public = Repo.get!(ArticlePublic, article.id)

      assert {:ok, saved} =
               CMS.Articles.save_working_copy(
                 article,
                 community,
                 work.id,
                 %{title: "Republished #{thread}"},
                 work.revision,
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

      after_publish = Repo.get_by!(ArticleStats, article_id: article.id)
      assert after_publish.comments_count == before.comments_count
      assert after_publish.comments_revision == before.comments_revision
      assert after_publish.comments_participants == before.comments_participants
    end
  end
end
