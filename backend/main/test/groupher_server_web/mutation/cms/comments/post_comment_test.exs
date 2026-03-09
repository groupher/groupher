defmodule GroupherServer.Test.Mutation.Comments.PostComment do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community post)a}
  end

  describe "[article comment CRUD]" do
    test "write article comment to a exist post", ~m(community post user_conn)a do
      variables = %{
        community: community.slug,
        thread: "POST",
        id: post.inner_id,
        body: mock_comment()
      }

      result = user_conn |> gq_mutation(Schema.m(:create_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(comment))
    end

    test "login user can reply to a comment", ~m(community post user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("reply comment")}

      result = user_conn |> gq_mutation(Schema.m(:reply_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(reply comment))
    end

    test "only owner can update a exist comment",
         ~m(community post user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("updated comment")}

      assert user_conn |> mutation_error?(Schema.m(:update_comment), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(Schema.m(:update_comment), variables, ecode(:account_login))

      result = owner_conn |> gq_mutation(Schema.m(:update_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(updated comment))
    end

    test "only owner can delete a exist comment",
         ~m(community post user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert user_conn |> mutation_error?(Schema.m(:delete_comment), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(Schema.m(:delete_comment), variables, ecode(:account_login))

      deleted = owner_conn |> gq_mutation(Schema.m(:delete_comment), variables)

      assert deleted["id"] == to_string(comment.id)
      assert deleted["isDeleted"]
    end
  end

  describe "[article comment upvote]" do
    test "login user can upvote a exist post comment",
         ~m(community post user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:upvote_comment), variables, ecode(:account_login))

      result = user_conn |> gq_mutation(Schema.m(:upvote_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert result["upvotesCount"] == 1
      assert result["viewerHasUpvoted"]
    end

    test "login user can undo upvote a exist post comment",
         ~m(community post user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id}
      user_conn |> gq_mutation(Schema.m(:upvote_comment), variables)

      assert guest_conn
             |> mutation_error?(Schema.m(:undo_upvote_comment), variables, ecode(:account_login))

      result = user_conn |> gq_mutation(Schema.m(:undo_upvote_comment), variables)

      assert result["upvotesCount"] == 0
      assert not result["viewerHasUpvoted"]
    end
  end

  describe "[article comment emotion]" do
    test "login user can emotion to a comment", ~m(community post user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id, emotion: "BEER"}
      comment = user_conn |> gq_mutation(Schema.m(:emotion_to_comment), variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(comment, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a comment", ~m(community post user owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :beer, user)

      variables = %{id: comment.id, emotion: "BEER"}
      comment = owner_conn |> gq_mutation(Schema.m(:undo_emotion_to_comment), variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(comment, ["emotions", "viewerHasBeered"])
    end
  end

  describe "[article comment lock/unlock]" do
    test "can lock a post's comment", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      passport_rules = %{community.slug => %{"post.lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:lock_comment, :post), variables)

      assert result["innerId"] == to_string(post.inner_id)

      {:ok, post} = ORM.find(Post, post.id)
      assert post.meta.is_comment_locked
    end

    test "unauth user fails", ~m(guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:lock_comment, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "can undo lock a post's comment", ~m(community post)a do
      {:ok, _} = CMS.Articles.lock_comments(post)
      {:ok, post} = ORM.find(Post, post.id)
      assert post.meta.is_comment_locked

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      passport_rules = %{community.slug => %{"post.undo_lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:unlock_comment, :post), variables)

      assert result["innerId"] == to_string(post.inner_id)

      {:ok, post} = ORM.find(Post, post.id)
      assert not post.meta.is_comment_locked
    end

    test "unauth user undo fails", ~m(guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:unlock_comment, :post),
               variables,
               ecode(:account_login)
             )
    end
  end

  describe "[article comment pin/unPin]" do
    test "can pin a post's comment", ~m(owner_conn community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(Schema.m(:pin_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert result["isPinned"]
    end

    test "unauth user fails", ~m(guest_conn community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:pin_comment), variables, ecode(:account_login))
    end

    test "can undo pin a post's comment", ~m(owner_conn community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(Schema.m(:undo_pin_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert not result["isPinned"]
    end

    test "unauth user undo fails", ~m(guest_conn community post user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id)
      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:undo_pin_comment), variables, ecode(:account_login))
    end
  end
end
