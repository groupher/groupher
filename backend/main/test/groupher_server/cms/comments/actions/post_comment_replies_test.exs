defmodule GroupherServer.Test.CMS.Comments.PostCommentReplies do
  @moduledoc false

  use GroupherServer.TestMate

  @max_parent_replies_count Comment.max_parent_replies_count()

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community post)a}
  end

  describe "[basic article comment replies]" do
    test "exist comment can be reply", ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, replied_comment} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      assert replied_comment.reply_to.id == parent_comment.id

      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)

      assert exist_in?(replied_comment, parent_comment.replies)
    end

    test "deleted comment can not be reply", ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.delete_comment(parent_comment)

      {:error, _} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
    end

    test "multi reply should belong to one parent comment", ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, replied_comment_1} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      {:ok, replied_comment_2} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)

      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)

      assert exist_in?(replied_comment_1, parent_comment.replies)
      assert exist_in?(replied_comment_2, parent_comment.replies)
    end

    test "reply to reply inside a comment should belong same parent comment",
         ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, replied_comment_1} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      {:ok, replied_comment_2} = CMS.Comments.reply_comment(replied_comment_1.id, mock_comment(), user2)
      {:ok, replied_comment_3} = CMS.Comments.reply_comment(replied_comment_2.id, mock_comment(), user)

      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)

      assert exist_in?(replied_comment_1, parent_comment.replies)
      assert exist_in?(replied_comment_2, parent_comment.replies)
      assert exist_in?(replied_comment_3, parent_comment.replies)

      {:ok, replied_comment_1} = ORM.find(Comment, replied_comment_1.id)
      {:ok, replied_comment_2} = ORM.find(Comment, replied_comment_2.id)
      {:ok, replied_comment_3} = ORM.find(Comment, replied_comment_3.id)

      assert replied_comment_1.reply_to_id == parent_comment.id
      assert replied_comment_2.reply_to_id == replied_comment_1.id
      assert replied_comment_3.reply_to_id == replied_comment_2.id
    end

    test "reply to reply inside a comment should have is_reply_to_others flag in meta",
         ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, replied_comment_1} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      {:ok, replied_comment_2} = CMS.Comments.reply_comment(replied_comment_1.id, mock_comment(), user2)
      {:ok, replied_comment_3} = CMS.Comments.reply_comment(replied_comment_2.id, mock_comment(), user)

      {:ok, _parent_comment} = ORM.find(Comment, parent_comment.id)

      {:ok, replied_comment_1} = ORM.find(Comment, replied_comment_1.id)
      {:ok, replied_comment_2} = ORM.find(Comment, replied_comment_2.id)
      {:ok, replied_comment_3} = ORM.find(Comment, replied_comment_3.id)

      assert not replied_comment_1.meta.is_reply_to_others
      assert replied_comment_2.meta.is_reply_to_others
      assert replied_comment_3.meta.is_reply_to_others
    end

    test "comment replies only contains @max_parent_replies_count replies",
         ~m(community post user)a do
      total_reply_count = @max_parent_replies_count + 1

      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      reply_comment_list =
        Enum.reduce(1..total_reply_count, [], fn n, acc ->
          {:ok, replied_comment} =
            CMS.Comments.reply_comment(parent_comment.id, mock_comment("reply_content_#{n}"), user)

          acc ++ [replied_comment]
        end)

      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)

      assert length(parent_comment.replies) == @max_parent_replies_count
      assert exist_in?(Enum.at(reply_comment_list, 0), parent_comment.replies)
      assert exist_in?(Enum.at(reply_comment_list, 1), parent_comment.replies)
      assert exist_in?(Enum.at(reply_comment_list, 2), parent_comment.replies)
      assert not exist_in?(List.last(reply_comment_list), parent_comment.replies)
    end

    test "replied user should appear in article comment participants",
         ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)

      {:ok, article} = ORM.find(Post, post.id)

      assert exist_in?(user, article.comments_participants)
      assert exist_in?(user2, article.comments_participants)
    end

    test "replies count should inc by 1 after got replied", ~m(community post user user2)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      assert parent_comment.replies_count === 0

      {:ok, _} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)
      assert parent_comment.replies_count === 1

      {:ok, _} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)
      {:ok, parent_comment} = ORM.find(Comment, parent_comment.id)
      assert parent_comment.replies_count === 2
    end
  end

  describe "[paged article comment replies]" do
    test "can get paged replies of a parent comment", ~m(community post user)a do
      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, paged_replies} = CMS.Comments.paged_comment_replies(parent_comment.id, %{page: 1, size: 20})
      assert is_valid_pagination?(paged_replies, :raw, :empty)

      total_reply_count = 30

      reply_comment_list =
        Enum.reduce(1..total_reply_count, [], fn n, acc ->
          {:ok, replied_comment} =
            CMS.Comments.reply_comment(parent_comment.id, mock_comment("reply_content_#{n}"), user)

          acc ++ [replied_comment]
        end)

      {:ok, paged_replies} = CMS.Comments.paged_comment_replies(parent_comment.id, %{page: 1, size: 20})

      assert total_reply_count == paged_replies.total_count
      assert is_valid_pagination?(paged_replies, :raw)

      assert exist_in?(Enum.at(reply_comment_list, 0), paged_replies.entries)
      # assert exist_in?(Enum.at(reply_comment_list, 1), paged_replies.entries)
      assert exist_in?(Enum.at(reply_comment_list, 2), paged_replies.entries)
      assert exist_in?(Enum.at(reply_comment_list, 3), paged_replies.entries)
    end

    test "can get reply_to info of a parent comment", ~m(community post user)a do
      page_number = 1
      page_size = 10

      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, reply_comment} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user)
      {:ok, reply_comment2} = CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user)

      {:ok, paged_comments} =
        CMS.Comments.paged_comments(
          :post,
          post.id,
          %{page: page_number, size: page_size},
          :timeline
        )

      reply_comment = Enum.find(paged_comments.entries, &(&1.id == reply_comment.id))

      assert reply_comment.reply_to.id == parent_comment.id
      assert reply_comment.reply_to.body_html == parent_comment.body_html
      assert reply_comment.reply_to.author.id == parent_comment.author_id

      reply_comment2 = Enum.find(paged_comments.entries, &(&1.id == reply_comment2.id))

      assert reply_comment2.reply_to.id == parent_comment.id
      assert reply_comment2.reply_to.body_html == parent_comment.body_html
      assert reply_comment2.reply_to.author.id == parent_comment.author_id
    end
  end
end
