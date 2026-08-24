defmodule GroupherServer.Test.CMS.Comments.Writer do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Artiment.Const
  alias GroupherServer.CMS.Model.{Comment, Post}
  alias Helper.ORM

  @article_cat Const.cat_map()

  test "create reloads the canonical Post before deriving question fields" do
    {_community, stale_post, _, actor} = mock_article(:post, preload: [author: :user])
    assert stale_post.cat != @article_cat.qa

    {:ok, _canonical_post} = CMS.Articles.set_cat(stale_post, @article_cat.qa)

    assert {:ok, %{is_for_question: true}} =
             CMS.Comments.create_comment(:post, stale_post, mock_comment(), actor)
  end

  test "reply reloads the canonical target and preserves the locked error contract" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    {:ok, %Comment{} = parent} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), actor)

    {:ok, locked_post} = ORM.find(Post, post.id)
    {:ok, _} = CMS.Articles.lock_comments(locked_post)

    assert {:error, %{reason: :article_comments_locked}} =
             CMS.Comments.reply_comment(parent.id, mock_comment(), actor)
  end
end
