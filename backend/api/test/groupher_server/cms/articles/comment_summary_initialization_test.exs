defmodule GroupherServer.Test.CMS.Articles.CommentSummaryInitializationTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleStats, Author, ArticleLifecycle, DocLifecycle}
  alias CMS.Articles.Draft.Store

  test "PUB-01 first and repeated publication preserve the one Comments owner" do
    for thread <- [:post, :blog, :changelog, :doc] do
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
      author = Repo.get!(Author, article.author_id)
      opts = if thread == :doc, do: [branch_id: view.branch_id], else: []
      {:ok, draft} = Store.ensure_from_public(article, author, opts)

      {:ok, updated} =
        Store.update(
          article,
          %{title: "Republished #{thread}"},
          author,
          Keyword.put(opts, :expected_version, draft.version)
        )

      lifecycle =
        if thread == :doc do
          Repo.get_by!(DocLifecycle, article_id: article.id, branch_id: view.branch_id)
        else
          Repo.get_by!(ArticleLifecycle, article_id: article.id)
        end

      publish_opts = [
        community: community,
        expected_draft_version: updated.version,
        expected_lifecycle_version: lifecycle.version,
        command_id: Ecto.UUID.generate()
      ]

      if thread == :doc do
        assert {:ok, _} =
                 CMS.Articles.Publish.Doc.publish(article, view.branch_id, author, publish_opts)
      else
        assert {:ok, _} = CMS.Articles.Publish.Target.publish(article, author, publish_opts)
      end

      after_publish = Repo.get_by!(ArticleStats, article_id: article.id)
      assert after_publish.comments_count == before.comments_count
      assert after_publish.comments_revision == before.comments_revision
      assert after_publish.comments_participants == before.comments_participants
    end
  end
end
