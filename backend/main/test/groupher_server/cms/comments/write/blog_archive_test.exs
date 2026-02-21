defmodule GroupherServer.Test.CMS.Comments.BlogArchive do
  @moduledoc false
  use GroupherServer.TestTools

  @archive_threshold get_config(:article, :archive_threshold)
  @comment_archive_threshold Timex.shift(@now, @archive_threshold[:default])

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, comment_long_ago} =
      db_insert(:comment, %{
        title: "last week",
        inserted_at: @last_year
      })

    {:ok, _} =
      CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

    {:ok, _} =
      CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

    {:ok, _} =
      CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

    {:ok, _} =
      CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

    {:ok, ~m(comment_long_ago)a}
  end

  describe "[cms comment archive]" do
    test "can archive comments", ~m(comment_long_ago)a do
      {:ok, _} = CMS.Comments.archive_comments()

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      assert length(archived_comments) == 1
      archived_comment = archived_comments |> List.first()
      assert archived_comment.id == comment_long_ago.id
    end

    test "can not edit archived comment" do
      {:ok, _} = CMS.Comments.archive_comments()

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      archived_comment = archived_comments |> List.first()
      {:error, reason} = CMS.Comments.update_comment(archived_comment, mock_comment("updated content"))
      assert reason |> is_error?(:archived)
    end

    test "can not delete archived comment" do
      {:ok, _} = CMS.Comments.archive_comments()

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      archived_comment = archived_comments |> List.first()

      {:error, reason} = CMS.Comments.delete_comment(archived_comment)
      assert reason |> is_error?(:archived)
    end
  end
end
