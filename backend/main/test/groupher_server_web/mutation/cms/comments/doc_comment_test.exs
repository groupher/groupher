defmodule GroupherServer.Test.Mutation.Comments.DocComment do
  @moduledoc false

  use GroupherServer.TestMate

  defp emotion_entry(emotions, type) do
    Enum.find(emotions || [], &(&1["type"] == String.upcase(to_string(type))))
  end

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn user guest_conn owner_conn community doc)a}
  end

  describe "[article comment CRUD]" do
    test "write article comment to a exist doc", ~m(community doc user_conn)a do
      variables = %{article: article_path(community, doc, :doc), body: mock_comment()}

      result = user_conn |> gq_mutation(S.Comment.m(:create_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(comment))
    end

    test "login user can reply to a comment", ~m(community doc user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{
        comment: comment_path(community, doc, :doc, comment),
        body: mock_comment("reply comment")
      }

      result = user_conn |> gq_mutation(S.Comment.m(:reply_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(reply comment))
    end

    test "only owner can update a exist comment",
         ~m(community doc user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{
        comment: comment_path(community, doc, :doc, comment),
        body: mock_comment("updated comment")
      }

      assert user_conn
             |> mutation_error?(S.Comment.m(:update_comment), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(S.Comment.m(:update_comment), variables, ecode(:account_login))

      result = owner_conn |> gq_mutation(S.Comment.m(:update_comment), variables)

      assert result["bodyHtml"] |> String.contains?(~s(<p))
      assert result["bodyHtml"] |> String.contains?(~s(updated comment))
    end

    test "only owner can delete a exist comment",
         ~m(community doc user guest_conn user_conn owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}

      assert user_conn
             |> mutation_error?(S.Comment.m(:delete_comment), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(S.Comment.m(:delete_comment), variables, ecode(:account_login))

      deleted = owner_conn |> gq_mutation(S.Comment.m(:delete_comment), variables)

      assert deleted["innerId"] == to_string(comment.inner_id)
    end
  end

  describe "[article comment upvote]" do
    test "login user can upvote a exist doc comment",
         ~m(community doc user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}

      assert guest_conn
             |> mutation_error?(S.Comment.m(:upvote_comment), variables, ecode(:account_login))

      result = user_conn |> gq_mutation(S.Comment.m(:upvote_comment), variables)

      assert result["innerId"] == to_string(comment.inner_id)
      assert result["upvotesCount"] == 1
      assert result["viewerHasUpvoted"]
    end

    test "login user can undo upvote a exist doc comment",
         ~m(community doc user guest_conn user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}
      user_conn |> gq_mutation(S.Comment.m(:upvote_comment), variables)

      assert guest_conn
             |> mutation_error?(
               S.Comment.m(:undo_upvote_comment),
               variables,
               ecode(:account_login)
             )

      result = user_conn |> gq_mutation(S.Comment.m(:undo_upvote_comment), variables)

      assert result["upvotesCount"] == 0
      assert not result["viewerHasUpvoted"]
    end
  end

  describe "[article comment emotion]" do
    test "login user can emotion to a comment", ~m(community doc user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment), emotion: "BEER"}
      comment = user_conn |> gq_mutation(S.Comment.m(:emotion_to_comment), variables)

      assert emotion_entry(comment["emotions"], :beer)["count"] == 1
      assert emotion_entry(comment["emotions"], :beer)["viewerHasReacted"]
    end

    test "comment emotion mutation returns sparse emotion array workflow",
         ~m(community doc user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      comment_path = comment_path(community, doc, :doc, comment)

      comment =
        user_conn
        |> gq_mutation(S.Comment.m(:emotion_to_comment), %{comment: comment_path, emotion: "BEER"})

      assert length(comment["emotions"]) == 1
      assert emotion_entry(comment["emotions"], :beer)["count"] == 1
      assert is_nil(emotion_entry(comment["emotions"], :heart))

      comment =
        user_conn
        |> gq_mutation(S.Comment.m(:emotion_to_comment), %{
          comment: comment_path,
          emotion: "HEART"
        })

      assert length(comment["emotions"]) == 2
      assert emotion_entry(comment["emotions"], :beer)["count"] == 1
      assert emotion_entry(comment["emotions"], :heart)["count"] == 1
    end

    test "login user can undo emotion to a comment", ~m(community doc user owner_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :beer, user)

      variables = %{comment: comment_path(community, doc, :doc, comment), emotion: "BEER"}
      comment = owner_conn |> gq_mutation(S.Comment.m(:undo_emotion_to_comment), variables)

      assert is_nil(emotion_entry(comment["emotions"], :beer))
    end

    test "comment emotion query reads back sparse array after mutation and undo",
         ~m(community doc user user_conn)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      comment_path = comment_path(community, doc, :doc, comment)

      _comment =
        user_conn
        |> gq_mutation(S.Comment.m(:emotion_to_comment), %{comment: comment_path, emotion: "BEER"})

      _comment =
        user_conn
        |> gq_mutation(S.Comment.m(:emotion_to_comment), %{
          comment: comment_path,
          emotion: "HEART"
        })

      result = user_conn |> gq_query(S.Comment.q(:one_comment_emotions), %{comment: comment_path})
      assert length(result["emotions"]) == 2
      assert emotion_entry(result["emotions"], :beer)["count"] == 1
      assert emotion_entry(result["emotions"], :heart)["count"] == 1

      _result =
        user_conn
        |> gq_mutation(S.Comment.m(:undo_emotion_to_comment), %{
          comment: comment_path,
          emotion: "HEART"
        })

      result = user_conn |> gq_query(S.Comment.q(:one_comment_emotions), %{comment: comment_path})
      assert length(result["emotions"]) == 1
      assert emotion_entry(result["emotions"], :beer)["count"] == 1
      assert is_nil(emotion_entry(result["emotions"], :heart))
    end
  end

  describe "[article comment lock/unlock]" do
    test "can lock a doc's comment", ~m(community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}
      passport_rules = %{community.slug => %{"doc.lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(S.Article.m(:lock_comment, :doc), variables)

      assert result["innerId"] == to_string(doc.inner_id)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.meta.is_comment_locked
    end

    test "unauth user fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:lock_comment, :doc),
               variables,
               ecode(:account_login)
             )
    end

    test "can undo lock a doc's comment", ~m(community doc)a do
      {:ok, _} = CMS.Articles.lock_comments(doc)
      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.meta.is_comment_locked

      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}
      passport_rules = %{community.slug => %{"doc.undo_lock_comment" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(S.Article.m(:unlock_comment, :doc), variables)

      assert result["innerId"] == to_string(doc.inner_id)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert not doc.meta.is_comment_locked
    end

    test "unauth user undo fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:unlock_comment, :doc),
               variables,
               ecode(:account_login)
             )
    end
  end

  describe "[article comment pin/unPin]" do
    test "can pin a doc's comment", ~m(owner_conn community doc user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}
      result = owner_conn |> gq_mutation(S.Comment.m(:pin_comment), variables)

      assert result["innerId"] == to_string(comment.inner_id)
      assert result["isPinned"]
    end

    test "unauth user fails", ~m(guest_conn community doc user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}

      assert guest_conn
             |> mutation_error?(S.Comment.m(:pin_comment), variables, ecode(:account_login))
    end

    test "can undo pin a doc's comment", ~m(owner_conn community doc user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id, user)

      variables = %{comment: comment_path(community, doc, :doc, comment)}
      result = owner_conn |> gq_mutation(S.Comment.m(:undo_pin_comment), variables)

      assert result["innerId"] == to_string(comment.inner_id)
      assert not result["isPinned"]
    end

    test "unauth user undo fails", ~m(guest_conn community doc user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

      {:ok, _} = CMS.Comments.pin_comment(comment.id, user)
      variables = %{comment: comment_path(community, doc, :doc, comment)}

      assert guest_conn
             |> mutation_error?(S.Comment.m(:undo_pin_comment), variables, ecode(:account_login))
    end
  end
end
