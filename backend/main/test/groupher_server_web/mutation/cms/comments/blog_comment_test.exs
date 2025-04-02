defmodule GroupherServer.Test.Mutation.Comments.BlogComment do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community blog)a}
  end

  describe "[article comment CRUD]" do
    @write_comment_query """
    mutation($community: String!, $thread: Thread!, $id: ID!, $body: String!) {
      createComment(community: $community, thread: $thread, id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
    test "write article comment to a exist blog", ~m(community blog user_conn)a do
      variables = %{
        community: community.slug,
        thread: "BLOG",
        id: blog.inner_id,
        body: mock_comment()
      }

      result = user_conn |> gq_mutation(@write_comment_query, variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(comment</p>))
    end

    @reply_comment_query """
    mutation($id: ID!, $body: String!) {
      replyComment(id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
    test "login user can reply to a comment", ~m(community blog user user_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("reply comment")}

      result = user_conn |> gq_mutation(@reply_comment_query, variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(reply comment</p>))
    end

    @update_comment_query """
    mutation($id: ID!, $body: String!) {
      updateComment(id: $id, body: $body) {
        id
        bodyHtml
      }
    }
    """
    test "only owner can update a exist comment",
         ~m(community blog user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("updated comment")}

      assert user_conn |> mutation_error?(@update_comment_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@update_comment_query, variables, ecode(:account_login))

      result = owner_conn |> gq_mutation(@update_comment_query, variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(updated comment</p>))
    end

    @delete_comment_query """
    mutation($id: ID!) {
      deleteComment(id: $id) {
        id
        isDeleted
      }
    }
    """
    test "only owner can delete a exist comment",
         ~m(community blog user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert user_conn |> mutation_error?(@delete_comment_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(@delete_comment_query, variables, ecode(:account_login))

      deleted = owner_conn |> gq_mutation(@delete_comment_query, variables)

      assert deleted["id"] == to_string(comment.id)
      assert deleted["isDeleted"]
    end
  end

  describe "[article comment upvote]" do
    @upvote_comment_query """
    mutation($id: ID!) {
      upvoteComment(id: $id) {
        id
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
    test "login user can upvote a exist blog comment",
         ~m(community blog user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(@upvote_comment_query, variables, ecode(:account_login))

      result = user_conn |> gq_mutation(@upvote_comment_query, variables)

      assert result["id"] == to_string(comment.id)
      assert result["upvotesCount"] == 1
      assert result["viewerHasUpvoted"]
    end

    @undo_upvote_comment_query """
    mutation($id: ID!) {
      undoUpvoteComment(id: $id) {
        id
        upvotesCount
        viewerHasUpvoted
      }
    }
    """
    test "login user can undo upvote a exist blog comment",
         ~m(community blog user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}
      user_conn |> gq_mutation(@upvote_comment_query, variables)

      assert guest_conn
             |> mutation_error?(@undo_upvote_comment_query, variables, ecode(:account_login))

      result = user_conn |> gq_mutation(@undo_upvote_comment_query, variables)

      assert result["upvotesCount"] == 0
      assert not result["viewerHasUpvoted"]
    end
  end

  describe "[article comment emotion]" do
    @emotion_comment_query """
    mutation($id: ID!, $emotion: CommentEmotion!) {
      emotionToComment(id: $id, emotion: $emotion) {
        id
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
            login
            nickname
          }
        }
      }
    }
    """
    test "login user can emotion to a comment", ~m(community blog user user_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, emotion: "BEER"}

      comment = user_conn |> gq_mutation(@emotion_comment_query, variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(comment, ["emotions", "viewerHasBeered"])
    end

    @emotion_comment_query """
    mutation($id: ID!, $emotion: CommentEmotion!) {
      undoEmotionToComment(id: $id, emotion: $emotion) {
        id
        emotions {
          beerCount
          viewerHasBeered
          latestBeerUsers {
            login
            nickname
          }
        }
      }
    }
    """
    test "login user can undo emotion to a comment", ~m(community blog user owner_conn)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.emotion_to_comment(comment.id, :beer, user)

      variables = %{id: comment.id, emotion: "BEER"}

      comment = owner_conn |> gq_mutation(@emotion_comment_query, variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(comment, ["emotions", "viewerHasBeered"])
    end
  end

  describe "[article comment lock/unlock]" do
    @tag :wip2
    test "can lock a blog's comment", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"blog.lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:lock_comment, :blog), variables)
      assert result["innerId"] == to_string(blog.inner_id)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.meta.is_comment_locked
    end

    test "unauth user fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:lock_comment, :blog),
               variables,
               ecode(:account_login)
             )
    end

    @tag :wip2
    test "can undo lock a blog's comment", ~m(community blog)a do
      {:ok, _} = CMS.lock_article_comments(blog)
      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.meta.is_comment_locked

      variables = %{id: blog.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"blog.undo_lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:unlock_comment, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert not blog.meta.is_comment_locked
    end

    test "unauth user undo fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:unlock_comment, :blog),
               variables,
               ecode(:account_login)
             )
    end
  end

  describe "[article comment pin/unPin]" do
    @query """
    mutation($id: ID!){
      pinComment(id: $id) {
        id
        isPinned
      }
    }
    """
    test "can pin a blog's comment", ~m(owner_conn community blog user)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(@query, variables)

      assert result["id"] == to_string(comment.id)
      assert result["isPinned"]
    end

    test "unauth user fails.", ~m(guest_conn community blog user)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!){
      undoPinComment(id: $id) {
        id
        isPinned
      }
    }
    """
    test "can undo pin a blog's comment", ~m(owner_conn community blog user)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.pin_comment(comment.id)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(@query, variables)

      assert result["id"] == to_string(comment.id)
      assert not result["isPinned"]
    end

    test "unauth user undo fails.", ~m(guest_conn community blog user)a do
      {:ok, comment} =
        CMS.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.pin_comment(comment.id)
      variables = %{id: comment.id}

      assert guest_conn |> mutation_error?(@query, variables, ecode(:account_login))
    end
  end
end
