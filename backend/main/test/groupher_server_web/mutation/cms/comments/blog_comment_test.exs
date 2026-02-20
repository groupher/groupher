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
    test "write article comment to a exist blog", ~m(community blog user_conn)a do
      variables = %{
        community: community.slug,
        thread: "BLOG",
        id: blog.inner_id,
        body: mock_comment()
      }

      result = user_conn |> gq_mutation(Schema.m(:create_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(comment</p>))
    end

    test "login user can reply to a comment", ~m(community blog user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("reply comment")}

      result = user_conn |> gq_mutation(Schema.m(:reply_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(reply comment</p>))
    end

    test "only owner can update a exist comment",
         ~m(community blog user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, body: mock_comment("updated comment")}

      assert user_conn |> mutation_error?(Schema.m(:update_comment), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(Schema.m(:update_comment), variables, ecode(:account_login))

      result = owner_conn |> gq_mutation(Schema.m(:update_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p id=))
      assert result["bodyHtml"] |> String.contains?(~s(updated comment</p>))
    end

    test "only owner can delete a exist comment",
         ~m(community blog user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

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
    test "login user can upvote a exist blog comment",
         ~m(community blog user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:upvote_comment), variables, ecode(:account_login))

      result = user_conn |> gq_mutation(Schema.m(:upvote_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert result["upvotesCount"] == 1
      assert result["viewerHasUpvoted"]
    end

    test "login user can undo upvote a exist blog comment",
         ~m(community blog user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

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
    test "login user can emotion to a comment", ~m(community blog user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id, emotion: "BEER"}
      comment = user_conn |> gq_mutation(Schema.m(:emotion_to_comment), variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 1
      assert get_in(comment, ["emotions", "viewerHasBeered"])
    end

    test "login user can undo emotion to a comment", ~m(community blog user owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :beer, user)

      variables = %{id: comment.id, emotion: "BEER"}
      comment = owner_conn |> gq_mutation(Schema.m(:undo_emotion_to_comment), variables)

      assert comment |> get_in(["emotions", "beerCount"]) == 0
      assert not get_in(comment, ["emotions", "viewerHasBeered"])
    end
  end

  describe "[article comment lock/unlock]" do
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

    test "can undo lock a blog's comment", ~m(community blog)a do
      {:ok, _} = CMS.Comments.lock_article_comments(blog)
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
    test "can pin a blog's comment", ~m(owner_conn community blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(Schema.m(:pin_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert result["isPinned"]
    end

    test "unauth user fails", ~m(guest_conn community blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:pin_comment), variables, ecode(:account_login))
    end

    test "can undo pin a blog's comment", ~m(owner_conn community blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id)

      variables = %{id: comment.id}
      result = owner_conn |> gq_mutation(Schema.m(:undo_pin_comment), variables)

      assert result["id"] == to_string(comment.id)
      assert not result["isPinned"]
    end

    test "unauth user undo fails", ~m(guest_conn community blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id)
      variables = %{id: comment.id}

      assert guest_conn
             |> mutation_error?(Schema.m(:undo_pin_comment), variables, ecode(:account_login))
    end
  end
end
