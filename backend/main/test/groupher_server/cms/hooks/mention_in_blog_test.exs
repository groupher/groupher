defmodule GroupherServer.Test.CMS.Hooks.MentionInBlog do
  @moduledoc false
  use GroupherServer.TestTools

  import Helper.Utils, only: [preload_author: 1]

  alias GroupherServer.Delivery
  alias CMS.Delegate.Hooks

  @article_mention_class "cdx-mention"

  setup do
    {community, blog, blog_attrs, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, ~m(user user2 user3 community blog blog_attrs)a}
  end

  describe "[mention in blog basic]" do
    test "mention multi user in blog should work",
         ~m(user user2 user3 community  blog_attrs)a do
      body =
        mock_rich_text(
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>, and <div class=#{@article_mention_class}>#{user3.login}</div>),
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>)
        )

      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      {:ok, blog} = preload_author(blog)

      {:ok, _} = Hooks.Mention.handle(blog)

      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "BLOG"
      assert mention.block_linker |> length == 2
      assert mention.article_id == blog.id
      assert mention.title == blog.title
      assert mention.user.login == blog.author.user.login

      {:ok, result} = Delivery.fetch(:mention, user3, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "BLOG"
      assert mention.block_linker |> length == 1
      assert mention.article_id == blog.id
      assert mention.title == blog.title
      assert mention.user.login == blog.author.user.login
    end

    test "mention in blog's comment should work", ~m(user user2 community blog)a do
      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>))

      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, comment_body, user)

      {:ok, comment} = preload_author(comment)

      {:ok, _} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "BLOG"
      assert mention.comment_id == comment.id
      assert mention.block_linker |> length == 1
      assert mention.article_id == blog.id
      assert mention.title == blog.title
      assert mention.user.login == comment.author.login
    end

    test "can not mention author self in blog or comment",
         ~m(community user blog_attrs)a do
      body = mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))
      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})
      assert result.total_count == 0

      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))

      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, comment_body, user)

      {:ok, _} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})

      assert result.total_count == 0
    end
  end
end
