defmodule GroupherServer.CMS.Comments.Actions do
  @moduledoc """
  Action operations for comments (pin, fold, lock, upvote, reply).
  """

  import Ecto.Query, warn: false

  import Helper.Utils,
    only: [
      done: 1,
      strip_struct: 1,
      get_config: 2
    ]

  import GroupherServer.CMS.FrontDesk,
    only: [sync_embed_replies: 1, article_of: 1, thread_of: 1]

  import Helper.ErrorCode

  import GroupherServer.CMS.Helper.Matcher

  alias Helper.Types, as: T
  alias Helper.{ORM, Later, Transaction}
  alias GroupherServer.{Accounts, Repo}
  alias GroupherServer.CMS.FrontDesk

  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.{Comment, PinnedComment, CommentUpvote, CommentReply}
  alias GroupherServer.CMS.Events
  alias GroupherServer.CMS.Comments.List, as: CommentList
  alias GroupherServer.CMS.Comments.Read, as: CommentRead

  alias Ecto.Multi

  @article_threads get_config(:article, :threads)

  @max_participator_count Comment.max_participator_count()
  @max_parent_replies_count Comment.max_parent_replies_count()
  @pinned_comment_limit Comment.pinned_comment_limit()

  @spec pin_comment(T.id()) :: T.domain_res(Comment.t())
  def pin_comment(comment_id) do
    with {:ok, {comment, full_comment, info}} <- pin_context(comment_id) do
      Multi.new()
      |> Multi.run(:checked_pined_comments_count, fn _, _ ->
        pined_comments_query =
          from(p in PinnedComment,
            where: field(p, ^info.foreign_key) == ^full_comment.article.id
          )

        with {:ok, pined_comments_count} <- ORM.count(pined_comments_query) do
          if pined_comments_count >= @pinned_comment_limit do
            {:error, {:comment_pin_limit, @pinned_comment_limit}}
          else
            {:ok, :pass}
          end
        end
      end)
      |> Multi.run(:update_comment_flag, fn _, _ ->
        ORM.update(comment, %{is_pinned: true})
      end)
      |> Multi.run(:add_pined_comment, fn _, _ ->
        attrs = %{comment_id: comment.id} |> Map.put(info.foreign_key, full_comment.article.id)

        PinnedComment |> ORM.create(attrs)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec undo_pin_comment(T.id()) :: T.domain_res(Comment.t())
  def undo_pin_comment(comment_id) do
    with {:ok, comment} <- CommentRead.fetch_comment(comment_id) do
      Multi.new()
      |> Multi.run(:update_comment_flag, fn _, _ ->
        ORM.update(comment, %{is_pinned: false})
      end)
      |> Multi.run(:remove_pined_comment, fn _, _ ->
        ORM.findby_delete(PinnedComment, %{comment_id: comment.id})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec fold_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def fold_comment(%Comment{} = comment, %User{} = _user), do: do_fold_comment(comment, true)

  def fold_comment(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_fold_comment(comment, true)
    end
  end

  @spec unfold_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def unfold_comment(comment_id, %User{} = _user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      do_fold_comment(comment, false)
    end
  end

  @spec reply_comment(T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def reply_comment(comment_id, body, %User{} = user) do
    with {:ok, target_comment} <- FrontDesk.get_by(Comment, %{id: comment_id, is_deleted: false}),
         replying_comment <- Repo.preload(target_comment, reply_to: :author),
         {thread, article} <- get_article(replying_comment),
         true <- can_comment?(article, user),
         {:ok, info} <- match(thread),
         parent_comment <- get_parent_comment(replying_comment) do
      Multi.new()
      |> Multi.run(:create_reply_comment, fn _, _ ->
        do_create_comment(body, info.foreign_key, article, user)
      end)
      |> Multi.run(:update_comments_count, fn _, %{create_reply_comment: replied_comment} ->
        {:ok, article} = article_of(replied_comment)
        ORM.inc(article, :comments_count)
      end)
      |> Multi.run(:create_comment_reply, fn _, %{create_reply_comment: replied_comment} ->
        CommentReply
        |> ORM.create(%{comment_id: replied_comment.id, reply_to_id: replying_comment.id})
      end)
      |> Multi.run(:add_participator, fn _, _ ->
        add_participant_to_article(article, user)
      end)
      |> Multi.run(:set_meta_flag, fn _, %{create_reply_comment: replied_comment} ->
        update_reply_to_others_state(parent_comment, replying_comment, replied_comment)
      end)
      |> Multi.run(:add_reply_to, fn _, %{create_reply_comment: replied_comment} ->
        replied_comment
        |> Repo.preload(:reply_to)
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:reply_to, replying_comment)
        |> Repo.update()
      end)
      |> Multi.run(:add_replies_ifneed, fn _, %{add_reply_to: replied_comment} ->
        add_replies_ifneed(parent_comment, replied_comment)
      end)
      |> Multi.run(:inc_replies_count, fn _, %{add_reply_to: replied_comment} ->
        filter = %{page: 1, size: 1}

        with {:ok, paged_replies} <- CommentList.paged_comment_replies(parent_comment.id, filter),
             {:ok, _} <- ORM.update(parent_comment, %{replies_count: paged_replies.total_count}) do
          {:ok, replied_comment}
        end
      end)
      |> Multi.run(:after_events, fn _, %{add_reply_to: replied_comment} ->
        Later.run({Events.Notify, :handle, [:reply, replied_comment, user]})
        Later.run({Events.Mention, :handle, [replied_comment]})
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> raise_error(:article_comments_locked, "this article is forbid comment")
      {:error, error} -> {:error, error}
    end
  end

  @spec upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def upvote_comment(comment_id, %User{id: user_id} = from_user) do
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
      |> Multi.run(:check_article_author_upvoted, fn _, %{inc_upvotes_count: comment} ->
        update_article_author_upvoted_info(comment, user_id)
      end)
      |> Multi.run(:viewer_states, fn _, %{check_article_author_upvoted: comment} ->
        viewer_has_upvoted = Enum.member?(comment.meta.upvoted_user_ids, user_id)
        viewer_has_reported = Enum.member?(comment.meta.reported_user_ids, user_id)

        comment
        |> Map.merge(%{viewer_has_upvoted: viewer_has_upvoted})
        |> Map.merge(%{viewer_has_reported: viewer_has_reported})
        |> done
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{viewer_states: comment} ->
        sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events.SubscribeCommunity, :handle, [comment, from_user]})
        Later.run({Events.Notify, :handle, [:upvote, comment, from_user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec undo_upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_upvote_comment(comment_id, %User{id: user_id} = from_user) do
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
      |> Multi.run(:desc_upvotes_count, fn _, %{remove_upvoted_user: comment} ->
        ORM.dec(comment, :upvotes_count)
      end)
      |> Multi.run(:unset_article_author_upvoted, fn _, %{desc_upvotes_count: updated_comment} ->
        meta = updated_comment.meta |> Map.put(:is_article_author_upvoted, false)
        updated_comment |> ORM.update_meta(meta)
      end)
      |> Multi.run(:viewer_states, fn _, %{unset_article_author_upvoted: comment} ->
        viewer_has_upvoted = Enum.member?(comment.meta.upvoted_user_ids, user_id)
        viewer_has_reported = Enum.member?(comment.meta.reported_user_ids, user_id)

        comment
        |> Map.merge(%{viewer_has_upvoted: viewer_has_upvoted})
        |> Map.merge(%{viewer_has_reported: viewer_has_reported})
        |> done
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{viewer_states: comment} ->
        sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, _ ->
        Later.run({Events.Notify, :handle, [:undo, :upvote, comment, from_user]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec lock_article_comments(term()) :: T.domain_res(term())
  def lock_article_comments(article) do
    Transaction.locking(article, fn article ->
      ORM.update_meta(article, %{is_comment_locked: true})
    end)
  end

  @spec undo_lock_article_comments(term()) :: T.domain_res(term())
  def undo_lock_article_comments(article) do
    Transaction.locking(article, fn article ->
      ORM.update_meta(article, %{is_comment_locked: false})
    end)
  end

  defp do_fold_comment(%Comment{} = comment, is_folded) when is_boolean(is_folded) do
    Multi.new()
    |> Multi.run(:fold_comment, fn _, _ ->
      comment |> ORM.update(%{is_folded: is_folded})
    end)
    |> Multi.run(:update_article_fold_count, fn _, _ ->
      {:ok, article} = article_of(comment)
      {:ok, article_thread} = thread_of(article)

      {:ok, %{total_count: total_count}} =
        CommentList.paged_folded_comments(article_thread, article.id, %{page: 1, size: 1})

      meta = article.meta |> Map.put(:folded_comment_count, total_count)
      article |> ORM.update_meta(meta)
    end)
    |> Repo.transaction()
    |> result()
  end

  defp can_comment?(article, _user) do
    not article.meta.is_comment_locked
  end

  defp update_article_author_upvoted_info(%Comment{} = comment, user_id) do
    with {:ok, article} = CommentRead.fetch_full_comment(comment.id) do
      is_article_author_upvoted = article.author.id == user_id
      meta = comment.meta |> Map.put(:is_article_author_upvoted, is_article_author_upvoted)
      comment |> ORM.update_meta(meta)
    end
  end

  defp get_parent_comment(%Comment{reply_to_id: nil} = comment), do: comment

  defp get_parent_comment(%Comment{reply_to_id: reply_to_id} = comment)
       when not is_nil(reply_to_id) do
    get_parent_comment(Repo.preload(comment.reply_to, reply_to: :author))
  end

  defp add_replies_ifneed(
         %Comment{replies: replies} = parent_comment,
         %Comment{} = replied_comment
       )
       when length(replies) < @max_parent_replies_count do
    new_replies =
      replies
      |> List.insert_at(length(replies), replied_comment)
      |> Enum.slice(0, @max_parent_replies_count)

    ORM.update_embed(parent_comment, :replies, new_replies)
  end

  defp add_replies_ifneed(%Comment{} = parent_comment, _) do
    {:ok, parent_comment}
  end

  defp get_article(%Comment{} = comment) do
    with article_thread <- find_comment_article_thread(comment),
         {:ok, info} <- match(article_thread),
         article_id <- Map.get(comment, info.foreign_key),
         {:ok, article} <- FrontDesk.get(info.model, article_id, preload: [author: :user]) do
      {article_thread, article}
    end
  end

  defp find_comment_article_thread(%Comment{} = comment) do
    @article_threads
    |> Enum.filter(&Map.get(comment, :"#{&1}_id"))
    |> List.first()
  end

  defp update_reply_to_others_state(parent_comment, replying_comment, replied_comment) do
    replying_comment = replying_comment |> Repo.preload(:author)
    parent_comment = parent_comment |> Repo.preload(:author)
    is_reply_to_others = parent_comment.author.id !== replying_comment.author.id

    case is_reply_to_others do
      true ->
        new_meta =
          replied_comment.meta
          |> Map.from_struct()
          |> Map.merge(%{is_reply_to_others: is_reply_to_others})

        ORM.update(replied_comment, %{meta: new_meta})

      false ->
        {:ok, :pass}
    end
  end

  @spec pin_context(T.id()) :: {:ok, {Comment.t(), map(), map()}} | {:error, atom() | {atom(), String.t()}}
  defp pin_context(comment_id) do
    with {:ok, comment} <- CommentRead.fetch_comment(comment_id),
         {:ok, full_comment} <- CommentRead.fetch_full_comment(comment.id),
         {:ok, info} <- match(full_comment.thread) do
      {:ok, {comment, full_comment, info}}
    end
  end

  defp update_upvoted_user_list(comment, user_id, opt) do
    cur_user_ids = get_in(comment, [:meta, :upvoted_user_ids])

    user_ids =
      case opt do
        :add -> [user_id] ++ cur_user_ids
        :remove -> cur_user_ids -- [user_id]
      end

    meta = comment.meta |> Map.merge(%{upvoted_user_ids: user_ids}) |> strip_struct
    ORM.update_meta(comment, meta)
  end

  defp do_create_comment(body, foreign_key, article, %User{id: user_id}) do
    import GroupherServer.CMS.Model.Embeds.CommentMeta, only: [default_meta: 0]
    import GroupherServer.CMS.Model.Embeds.CommentEmotion, only: [default_emotions: 0]

    with {:ok, %{body: body, body_html: body_html}} <-
           Helper.Converter.Article.parse_body(body) do
      thread = foreign_key |> to_string |> String.slice(0..-4) |> String.upcase()

      attrs = %{
        author_id: user_id,
        body: body,
        body_html: body_html,
        emotions: default_emotions(),
        floor: next_floor(article, foreign_key),
        is_article_author: user_id == article.author.user.id,
        thread: thread,
        meta: default_meta()
      }

      Comment |> ORM.create(Map.put(attrs, foreign_key, article.id))
    end
  end

  defp add_participant_to_article(%{comments_participants: participants} = article, %User{} = user) do
    cur_participants = participants |> List.insert_at(0, user) |> Enum.uniq_by(& &1.id)

    meta = article.meta |> Map.from_struct()
    cur_participants_ids = (meta[:comments_participant_user_ids] ++ [user.id]) |> Enum.uniq()
    meta = Map.merge(meta, %{comments_participant_user_ids: cur_participants_ids})

    latest_participants = cur_participants |> Enum.slice(0, @max_participator_count)

    article
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_change(:comments_participants_count, cur_participants_ids |> length)
    |> Ecto.Changeset.put_embed(:comments_participants, latest_participants)
    |> Ecto.Changeset.put_embed(:meta, meta)
    |> Repo.update()
  end

  defp add_participant_to_article(_, _), do: {:ok, :pass}

  defp next_floor(article, foreign_key) do
    {:ok, cur_count} =
      from(c in Comment, where: field(c, ^foreign_key) == ^article.id)
      |> ORM.count()

    cur_count + 1
  end

  defp result({:ok, %{create_comment: result}}), do: {:ok, result}
  defp result({:ok, %{inc_replies_count: result}}), do: {:ok, result}
  defp result({:ok, %{sync_embed_replies: result}}), do: {:ok, result}
  defp result({:ok, %{update_comment_flag: result}}), do: {:ok, result}
  defp result({:ok, %{delete_comment: result}}), do: {:ok, result}
  defp result({:ok, %{fold_comment: result}}), do: {:ok, result}

  defp result({:error, :create_comment, _result, _steps}) do
    raise_error(:create_comment, "create comment error")
  end

  defp result({:error, :create_comment_upvote, _result, _steps}) do
    raise_error(:comment_already_upvote, "already upvoted")
  end

  defp result({:error, :update_comment_flag, _result, _steps}), do: {:error, :update_fails}
  defp result({:error, :add_pined_comment, _result, _steps}), do: {:error, :create_fails}
  defp result({:error, :remove_pined_comment, _result, _steps}), do: {:error, :delete_fails}

  defp result({:error, :add_participator, result, _steps}) do
    {:error, result}
  end

  defp result({:error, :create_abuse_report, result, _steps}) do
    {:error, result}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
