defmodule GroupherServer.Test.CMS.Comments.PostArchive do
  @moduledoc false
  use GroupherServer.TestTools
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Comment

  @now Timex.now() |> DateTime.truncate(:second)
  @archive_threshold get_config(:article, :archive_threshold)
  @comment_archive_threshold Timex.shift(@now, @archive_threshold[:default])

  @last_year Timex.shift(@now, years: -1, seconds: -1)

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    post_attrs = mock_attrs(:post, %{community_id: community.id, author: %{user: user}})
    {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

    {:ok, comment_long_ago} =
      db_insert(:comment, %{
        title: "last year",
        inserted_at: DateTime.truncate(@last_year, :second)
      })

    {:ok, _} = CMS.create_comment2(community, :post, post.inner_id, mock_comment(), user)
    {:ok, _} = CMS.create_comment2(community, :post, post.inner_id, mock_comment(), user)
    {:ok, _} = CMS.create_comment2(community, :post, post.inner_id, mock_comment(), user)
    {:ok, _} = CMS.create_comment2(community, :post, post.inner_id, mock_comment(), user)

    {:ok, ~m(comment_long_ago)a}
  end

  describe "[cms comment archive]" do
    @tag :wip2
    test "can archive comments", ~m(comment_long_ago)a do
      {:ok, _} = CMS.archive_articles(:comment)

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      assert length(archived_comments) == 1
      archived_comment = archived_comments |> List.first()
      assert archived_comment.id == comment_long_ago.id
    end

    @tag :wip2
    test "can not edit archived comment" do
      {:ok, _} = CMS.archive_articles(:comment)

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      archived_comment = archived_comments |> List.first()
      {:error, reason} = CMS.update_comment(archived_comment, mock_comment("updated content"))
      assert reason |> is_error?(:archived)
    end

    @tag :wip2
    test "can not delete archived comment" do
      {:ok, _} = CMS.archive_articles(:comment)

      archived_comments =
        Comment
        |> where([article], article.inserted_at < ^@comment_archive_threshold)
        |> Repo.all()

      archived_comment = archived_comments |> List.first()

      {:error, reason} = CMS.delete_comment(archived_comment)
      assert reason |> is_error?(:archived)
    end
  end
end
