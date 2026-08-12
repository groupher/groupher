defmodule GroupherServer.CMS.Comments.Write do
  @moduledoc """
  CRUD operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]
  import Helper.ErrorCode

  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User

  alias CMS.{FrontDesk, Gate}

  alias CMS.Comments.{BodyCodec, Numbering, Participants, Replies, States}
  alias CMS.Events
  alias CMS.Artiment.Enums
  alias CMS.Model.{Comment, CommentReply, Community, Embeds, PinnedComment, Post}
  alias CMS.SearchArtiments.Indexer

  alias Helper.{Datetime, Multi, Later, ORM, T}

  @delete_hint Comment.delete_hint()

  @archive_threshold GroupherServer.CMS.Artiment.Config.archive_threshold()
  @max_parent_replies_count Comment.max_parent_replies_count()
  @default_emotions Embeds.CommentEmotion.default_emotions()
  @default_comment_meta Embeds.CommentMeta.default_meta()

  @article_cat Enums.cat_values() |> Enum.into(%{}, &{&1, &1})
  @article_status Enums.status_values() |> Enum.into(%{}, &{&1, &1})

  @spec create(Community.t(), T.thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create(%Community{} = community, thread, article_id, body, %User{} = user) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           FrontDesk.article(community, thread, article_id,
             preload: [[author: :user], :community]
           ),
         {:ok, comment} <- do_create(thread, article, body, user, info) do
      {:ok, comment}
    end
  end

  @spec create(T.thread(), T.article(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def create(thread, article, body, %User{} = user) do
    with {:ok, info} <- match(thread) do
      do_create(thread, article, body, user, info)
    end
  end

  defp do_create(thread, article, body, %User{} = user, info) do
    article = Repo.preload(article, [[author: :user], :community])

    with {:ok, _} <- Gate.allow_comment(article) do
      Multi.new()
      |> Multi.run(:create_comment, fn _, _ ->
        insert_comment(body, thread, info.foreign_key, article, user)
      end)
      |> Multi.run(:update_comments_count, fn _, %{create_comment: comment} ->
        {:ok, article} = FrontDesk.article_of(comment)
        ORM.inc(article, :comments_count)
      end)
      |> Multi.run(:set_question_flag_ifneed, fn _, %{create_comment: comment} ->
        set_question_flag_ifneed(article, comment)
      end)
      |> Multi.run(:add_participator, fn _, _ ->
        Participants.add_to_article(article, user)
      end)
      |> Multi.run(:update_article_active_timestamp, fn _, %{create_comment: comment} ->
        case comment.author_id == article.author.user.id do
          true -> {:ok, :pass}
          false -> CMS.Articles.update_active_timestamp(thread, article)
        end
      end)
      |> Multi.run(:after_events, fn _, %{create_comment: comment} ->
        Later.run({Events, :emit, [:sync_mentions, %{artiment: comment}]})
        Later.run({Events, :emit, [:notify_comment, %{comment: comment, from_user: user}]})
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})

        Later.run(
          {Events, :emit, [:subscribe_community, %{target: article.community, user: user}]}
        )
      end)
      |> Repo.transaction()
      |> result()
      |> sync_article_metrics(article)
    else
      {:error, :article_comments_locked} ->
        raise_error(:article_comments_locked, "this article is forbid comment")
    end
  end

  @spec reply(T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def reply(comment_id, body, %User{} = user) do
    with {:ok, target_comment} <- FrontDesk.get_by(Comment, %{id: comment_id, is_deleted: false}),
         replying_comment <- Repo.preload(target_comment, reply_to_comment: :author),
         {:ok, thread} <- FrontDesk.thread_of(replying_comment),
         {:ok, article} <- FrontDesk.article_of(replying_comment, preload: [author: :user]),
         {:ok, _} <- Gate.allow_comment(article),
         {:ok, info} <- match(thread),
         parent_comment <- Replies.root_comment(replying_comment) do
      Multi.new()
      |> Multi.run(:create_reply_comment, fn _, _ ->
        insert_comment(body, thread, info.foreign_key, article, user, replying_comment)
      end)
      |> Multi.run(:update_comments_count, fn _, %{create_reply_comment: replied_comment} ->
        {:ok, article} = FrontDesk.article_of(replied_comment)
        ORM.inc(article, :comments_count)
      end)
      |> Multi.run(:create_comment_reply, fn _, %{create_reply_comment: replied_comment} ->
        CommentReply
        |> ORM.create(%{comment_id: replied_comment.id, reply_to_comment_id: replying_comment.id})
      end)
      |> Multi.run(:add_participator, fn _, _ ->
        Participants.add_to_article(article, user)
      end)
      |> Multi.run(:set_meta_flag, fn _, %{create_reply_comment: replied_comment} ->
        update_reply_to_others_state(parent_comment, replying_comment, replied_comment)
      end)
      |> Multi.run(:add_reply_to_comment, fn _, %{create_reply_comment: replied_comment} ->
        replied_comment
        |> Repo.preload(:reply_to_comment)
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:reply_to_comment, replying_comment)
        |> Repo.update()
      end)
      |> Multi.run(:add_replies_ifneed, fn _, %{add_reply_to_comment: replied_comment} ->
        add_replies_ifneed(parent_comment, replied_comment)
      end)
      |> Multi.run(:inc_replies_count, fn _, %{add_reply_to_comment: replied_comment} ->
        with {:ok, _parent_comment} <- ORM.inc(parent_comment, :replies_count) do
          {:ok, replied_comment}
        end
      end)
      |> Multi.run(:after_events, fn _, %{add_reply_to_comment: replied_comment} ->
        Later.run(
          {Events, :emit, [:notify_reply, %{reply_comment: replied_comment, from_user: user}]}
        )

        Later.run({Events, :emit, [:sync_mentions, %{artiment: replied_comment}]})
      end)
      |> Repo.transaction()
      |> result()
      |> sync_article_metrics(article)
    else
      {:error, :article_comments_locked} ->
        raise_error(:article_comments_locked, "this article is forbid comment")

      {:error, error} ->
        {:error, error}
    end
  end

  @spec update(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def update(%{is_archived: true}, _body),
    do: raise_error(:archived, "comment is archived, can not be edit or delete")

  def update(%Comment{is_solution: true} = comment, body) do
    with {:ok, post} <- FrontDesk.get(Post, comment.post_id),
         {:ok, payload} <- BodyCodec.parse(body) do
      Multi.new()
      |> Multi.run(:update_parent_post, fn _, _ ->
        ORM.update(post, %{solution_digest: payload.digest})
      end)
      |> Multi.run(:update_comment, fn _, _ ->
        comment |> ORM.update(%{body: payload.json, body_html: payload.html})
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{update_comment: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, %{update_comment: comment} ->
        Later.run({Events, :emit, [:sync_mentions, %{artiment: comment}]})
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def update(%Comment{} = comment, body) do
    with {:ok, payload} <- BodyCodec.parse(body) do
      Multi.new()
      |> Multi.run(:update_comment, fn _, _ ->
        ORM.update(comment, %{body: payload.json, body_html: payload.html})
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{update_comment: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, %{update_comment: comment} ->
        Later.run({Events, :emit, [:sync_mentions, %{artiment: comment}]})
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec delete(Comment.t()) :: T.domain_res(Comment.t())
  def delete(%{is_archived: true}),
    do: raise_error(:archived, "comment is archived, can not be edit or delete")

  def delete(%Comment{} = comment) do
    with {:ok, article} <- FrontDesk.article_of(comment) do
      Multi.new()
      |> Multi.run(:update_comments_count, fn _, _ ->
        ORM.dec(article, :comments_count)
      end)
      |> Multi.run(:remove_pined_comment, fn _, _ ->
        ORM.findby_delete(PinnedComment, %{comment_id: comment.id})
      end)
      |> Multi.run(:delete_comment, fn _, _ ->
        ORM.update(comment, %{body_html: @delete_hint, is_deleted: true})
      end)
      |> Repo.transaction()
      |> result()
      |> sync_article_metrics(article)
    end
  end

  @spec mark_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def mark_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, post} <- FrontDesk.get(Post, comment.post_id, preload: [author: :user]) do
      do_mark_comment_solution(post, comment, user, true)
    end
  end

  @spec undo_mark_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_mark_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, post} <- FrontDesk.get(Post, comment.post_id, preload: [author: :user]) do
      do_mark_comment_solution(post, comment, user, false)
    end
  end

  defp do_mark_comment_solution(post, %Comment{} = comment, %User{} = user, is_solution) do
    case user.id == post.author.user.id do
      true ->
        Multi.new()
        |> Multi.run(:clear_solution_flags, fn _, _ ->
          batch_update_solution_flag(post, false)
        end)
        |> Multi.run(:pin_comment, fn _, _ ->
          if is_solution do
            States.pin(comment.id)
          else
            States.undo_pin(comment.id)
          end
        end)
        |> Multi.run(:mark_solution, fn _, %{pin_comment: updated_comment} ->
          ORM.update(updated_comment, %{is_solution: is_solution, is_for_question: true})
        end)
        |> Multi.run(:update_post_state, fn _, _ ->
          update_post_state_for_solution(post, comment, is_solution)
        end)
        |> Multi.run(:sync_embed_replies, fn _, %{mark_solution: updated_comment} ->
          FrontDesk.sync_embed_replies(updated_comment)
        end)
        |> Repo.transaction()
        |> result()

      false ->
        raise_error(:require_questioner, "oops, questioner only")
    end
  end

  @spec update_user_in_comments_participants(User.t()) :: T.domain_res(term())
  def update_user_in_comments_participants(%User{login: login}) do
    from(a in CMS.Model.Post,
      cross_join: cp in fragment("jsonb_array_elements(?)", a.comments_participants),
      where: fragment("?->>'login' = ?", cp, ^login)
    )
    |> Repo.all()
    |> done()
  end

  @spec archive_comments() :: T.domain_res(term())
  def archive_comments do
    now = Datetime.now(:second)
    threshold = @archive_threshold[:default]
    archive_threshold = Datetime.shift(now, threshold)

    Comment
    |> where([c], c.inserted_at < ^archive_threshold)
    |> Repo.update_all(set: [is_archived: true, archived_at: now])
    |> done()
  end

  @spec batch_update_question_flag(Post.t(), boolean()) :: T.domain_res(term())
  def batch_update_question_flag(%Post{} = post, is_question) do
    from(c in Comment, where: c.post_id == ^post.id)
    |> Repo.update_all(set: [is_for_question: is_question])
    |> done()
  end

  defp set_question_flag_ifneed(%Post{cat: cat}, %Comment{} = comment) do
    question_type = @article_cat.qa

    case cat do
      ^question_type ->
        ORM.update(comment, %{is_for_question: true})

      _ ->
        ORM.update(comment, %{is_for_question: false})
    end
  end

  defp set_question_flag_ifneed(_, comment), do: {:ok, comment}

  defp batch_update_solution_flag(%Post{} = post, is_question) do
    from(c in Comment,
      where: c.post_id == ^post.id,
      update: [set: [is_solution: ^is_question]]
    )
    |> Repo.update_all([])

    {:ok, :pass}
  end

  defp update_post_state_for_solution(post, comment, is_solution) do
    solution_digest =
      if is_solution do
        case BodyCodec.parse(comment.body) do
          {:ok, payload} -> payload.digest
          _ -> comment.body_html
        end
      else
        nil
      end

    case ORM.update(post, %{solution_digest: solution_digest}) do
      {:ok, updated_post} ->
        status = if is_solution, do: @article_status.resolved, else: @article_status.default
        CMS.Articles.set_status(updated_post, status)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp insert_comment(
         body,
         thread,
         foreign_key,
         article,
         %User{id: user_id},
         reply_to_comment \\ nil
       ) do
    with {:ok, payload} <- BodyCodec.parse(body),
         {:ok, inner_id} <- Numbering.next_inner_id(article, foreign_key),
         {:ok, floor} <- Numbering.next_floor(article, foreign_key) do
      attrs = %{
        author_id: user_id,
        body: payload.json,
        body_html: payload.html,
        emotions: @default_emotions,
        inner_id: inner_id,
        floor: floor,
        is_article_author: user_id == article.author.user.id,
        thread: thread,
        meta: @default_comment_meta,
        root_comment_id: root_comment_id(reply_to_comment)
      }

      Comment |> ORM.create(Map.put(attrs, foreign_key, article.id))
    end
  end

  defp root_comment_id(nil), do: nil
  defp root_comment_id(%{root_comment_id: root_id}) when not is_nil(root_id), do: root_id
  defp root_comment_id(%{id: reply_to_comment_id}), do: reply_to_comment_id

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

  defp sync_article_metrics({:ok, _value} = result, article) do
    _ = Indexer.enqueue_metrics(article)
    result
  end

  defp sync_article_metrics(result, _article), do: result

  defp result({:ok, %{set_question_flag_ifneed: result}}), do: {:ok, result}
  defp result({:ok, %{inc_replies_count: result}}), do: {:ok, result}
  defp result({:ok, %{delete_comment: result}}), do: {:ok, result}
  defp result({:ok, %{mark_solution: result}}), do: {:ok, result}
  defp result({:ok, %{sync_embed_replies: result}}), do: {:ok, result}

  defp result({:error, :create_comment, result, _steps}) do
    raise_error(:create_comment, result)
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
