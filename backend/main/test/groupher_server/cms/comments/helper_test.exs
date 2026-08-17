defmodule GroupherServer.Test.CMS.Comments.SupportModules do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Communities.Enable
  alias CMS.Comments.{Numbering, Replies}
  alias CMS.Interactions.State
  alias Helper.ORM

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(community user user2 post)a}
  end

  describe "next_floor/2" do
    test "should return 1 for first comment", ~m(post)a do
      {:ok, floor} = Numbering.next_floor(post, :post_id)
      assert floor == 1

      # 验证 article 的 next_floor 字段已更新
      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      assert updated_post.meta.next_floor == 1
    end

    test "should increment floor number for subsequent comments", ~m(post)a do
      # 第一条评论
      {:ok, floor1} = Numbering.next_floor(post, :post_id)
      assert floor1 == 1

      # 第二条评论
      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      {:ok, floor2} = Numbering.next_floor(updated_post, :post_id)
      assert floor2 == 2

      # 验证 article 的 next_floor 字段已更新
      {:ok, updated_post2} = ORM.find(post.__struct__, post.id)
      assert updated_post2.meta.next_floor == 2
    end

    test "should return domain error when next_floor allocation fails", ~m(post)a do
      post = put_in(post.meta.__struct__, nil)

      {:error, reason} = Numbering.next_floor(post, :post_id)
      assert error_code(reason) == ecode(:update_fails)
    end
  end

  describe "next_inner_id/2" do
    test "should return 1 for first comment inner_id", ~m(post)a do
      {:ok, inner_id} = Numbering.next_inner_id(post, :post_id)
      assert inner_id == 1

      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      assert updated_post.meta.next_comment_inner_id == 1
    end

    test "should increment comment inner_id independently from floor", ~m(post)a do
      {:ok, inner_id} = Numbering.next_inner_id(post, :post_id)
      assert inner_id == 1

      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      {:ok, floor} = Numbering.next_floor(updated_post, :post_id)
      assert floor == 1

      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      {:ok, inner_id} = Numbering.next_inner_id(updated_post, :post_id)
      assert inner_id == 2

      {:ok, updated_post} = ORM.find(post.__struct__, post.id)
      assert updated_post.meta.next_comment_inner_id == 2
      assert updated_post.meta.next_floor == 1
    end

    test "should return domain error when inner_id allocation fails", ~m(post)a do
      post = put_in(post.meta.__struct__, nil)

      {:error, reason} = Numbering.next_inner_id(post, :post_id)
      assert error_code(reason) == ecode(:update_fails)
    end
  end

  describe "root_comment/1" do
    test "should return the comment itself if it's not a reply", ~m(community user post)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      parent_comment = Replies.root_comment(comment)
      assert parent_comment.id == comment.id
    end

    test "should return the root comment for a reply", ~m(community user user2 post)a do
      # 创建根评论
      {:ok, root_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      # 创建回复
      {:ok, reply_comment} = CMS.Comments.reply_comment(root_comment.id, mock_comment(), user2)

      # 验证回复的 root_comment_id 已设置
      assert reply_comment.root_comment_id == root_comment.id

      # 测试 root_comment
      parent_comment = Replies.root_comment(reply_comment)
      assert parent_comment.id == root_comment.id
    end
  end

  describe "mark_has_upvoted/2" do
    test "should mark viewer has upvoted for comments", ~m(community user user2 post)a do
      # 创建评论
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      # 点赞评论
      {:ok, _} = CMS.Comments.upvote_comment(comment.id, user2)

      # 重新加载评论以获取更新的 meta 字段
      {:ok, updated_comment} = ORM.find(comment.__struct__, comment.id)

      # 测试 mark_has_upvoted
      paged_comments = %{entries: [updated_comment]}

      marked_comments = %{
        paged_comments
        | entries: State.read(:comment, paged_comments.entries, user2, [])
      }

      assert List.first(marked_comments.entries).viewer_has_upvoted == true
    end

    test "should return comments unchanged when viewer is nil", ~m(community user post)a do
      # 创建评论
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      # 测试 mark_has_upvoted with nil viewer
      paged_comments = %{entries: [comment]}

      marked_comments = %{
        paged_comments
        | entries: State.read(:comment, paged_comments.entries, nil, [])
      }

      assert List.first(marked_comments.entries).viewer_has_upvoted == false
      assert List.first(marked_comments.entries).viewer_has_reported == false
    end
  end

  describe "allow_comment/2" do
    test "should return true if article is not comment locked", ~m(post user)a do
      assert {:ok, ^post} = Enable.comment?(post)
    end

    test "should return false if article is comment locked", ~m(post user)a do
      # 锁定评论
      {:ok, locked_post} = CMS.Articles.lock_comments(post)
      assert {:error, :article_comments_locked} = Enable.comment?(locked_post)
    end
  end
end
