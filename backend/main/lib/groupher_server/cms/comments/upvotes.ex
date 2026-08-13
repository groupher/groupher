defmodule GroupherServer.CMS.Comments.Upvotes do
  @moduledoc """
  Upvote operations for comments.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Upvotes
        -> Repo / domain event
  """

  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1, strip_struct: 1]

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias Helper.{Later, Multi, ORM, T}

  alias CMS.Events
  alias CMS.FrontDesk
  alias CMS.Model.{Comment, CommentUpvote}

  @spec upvote(T.id(), User.t()) :: T.domain_res(Comment.t())
  def upvote(comment_id, %User{id: user_id} = from_user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         false <- comment.is_deleted do
      Multi.new()
      |> Multi.run(:create_comment_upvote, fn _, _ ->
        ORM.create(CommentUpvote, %{comment_id: comment.id, user_id: user_id})
      end)
      |> Multi.run(:add_upvoted_user, fn _, _ ->
        update_upvoted_user_list(comment, user_id, :add)
      end)
      |> Multi.run(:inc_upvotes_count, fn _, %{add_upvoted_user: comment} ->
        ORM.inc(comment, :upvotes_count)
      end)
      |> Multi.run(:mark_article_author_upvoted, fn _, %{inc_upvotes_count: comment} ->
        mark_article_author_upvoted_ifneed(comment, user_id, true)
      end)
      |> Multi.run(:viewer_states, fn _, %{mark_article_author_upvoted: comment} ->
        viewer_states(comment, user_id)
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{viewer_states: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events, :emit, [:subscribe_community, %{target: comment, user: from_user}]})
        Later.run({Events, :emit, [:notify_upvote, %{target: comment, from_user: from_user}]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec undo(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo(comment_id, %User{id: user_id} = from_user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         false <- comment.is_deleted do
      Multi.new()
      |> Multi.run(:delete_comment_upvote, fn _, _ ->
        ORM.findby_delete(CommentUpvote, %{
          comment_id: comment.id,
          user_id: user_id
        })
      end)
      |> Multi.run(:remove_upvoted_user, fn _, _ ->
        update_upvoted_user_list(comment, user_id, :remove)
      end)
      |> Multi.run(:dec_upvotes_count, fn _, %{remove_upvoted_user: comment} ->
        ORM.dec(comment, :upvotes_count)
      end)
      |> Multi.run(:unmark_article_author_upvoted, fn _, %{dec_upvotes_count: comment} ->
        mark_article_author_upvoted_ifneed(comment, user_id, false)
      end)
      |> Multi.run(:viewer_states, fn _, %{unmark_article_author_upvoted: comment} ->
        viewer_states(comment, user_id)
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{viewer_states: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run(
          {Events, :emit, [:notify_undo_upvote, %{target: comment, from_user: from_user}]}
        )
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp mark_article_author_upvoted_ifneed(%Comment{} = comment, user_id, value) do
    with {:ok, article} <- FrontDesk.article_of(comment, preload: [author: :user]) do
      case get_in(article, [:author, :user, :id]) == user_id do
        true ->
          meta = comment.meta |> Map.put(:is_article_author_upvoted, value)
          ORM.update_meta(comment, meta)

        false ->
          {:ok, comment}
      end
    end
  end

  defp viewer_states(%Comment{} = comment, user_id) do
    viewer_has_upvoted = Enum.member?(comment.meta.upvoted_user_ids, user_id)
    viewer_has_reported = Enum.member?(comment.meta.reported_user_ids, user_id)

    comment
    |> Map.merge(%{viewer_has_upvoted: viewer_has_upvoted})
    |> Map.merge(%{viewer_has_reported: viewer_has_reported})
    |> done()
  end

  defp update_upvoted_user_list(comment, user_id, opt) do
    cur_user_ids = get_in(comment, [:meta, :upvoted_user_ids])

    user_ids =
      case opt do
        :add -> [user_id] ++ cur_user_ids
        :remove -> cur_user_ids -- [user_id]
      end

    meta = comment.meta |> Map.merge(%{upvoted_user_ids: user_ids}) |> strip_struct()
    ORM.update_meta(comment, meta)
  end

  defp result({:ok, %{sync_embed_replies: result}}), do: {:ok, result}

  defp result({:error, :create_comment_upvote, _result, _steps}) do
    raise_error(:comment_already_upvote, "already upvoted")
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
