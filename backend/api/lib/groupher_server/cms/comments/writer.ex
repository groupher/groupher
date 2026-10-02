defmodule GroupherServer.CMS.Comments.Writer do
  @moduledoc """
  Creation and reply orchestration for Comments writes.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Writer create/reply
        -> Gate.Access.with_check
        -> canonical aggregate transaction + required audition job
        -> commit
        -> best-effort mention / notification / subscription jobs
  """

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.{Comments.ErrorCat, Artiment.Const, Command, FrontDesk, Gate}
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.ErrorCat, as: CmsErrorCat

  alias CMS.Comments.{
    BodyCodec,
    JobPolicy,
    Lifecycle,
    Numbering,
    Replies
  }

  alias CMS.Model.{
    Comment,
    CommentReply,
    Community,
    Embeds,
    Article,
    PostState
  }

  alias Analysis.MetricEvent
  alias Helper.{ORM, T}

  @max_parent_replies_count Comment.max_parent_replies_count()
  @default_emotions Embeds.CommentEmotion.default_persisted_emotions()
  @default_comment_meta Embeds.CommentMeta.default_meta()
  @article_cat Const.cat_values() |> Enum.into(%{}, &{&1, &1})

  @doc """
  Creates a top-level comment on an article identified by community, thread,
  and article id.

  Runs lifecycle creation, counters, participants and required audition enqueue
  in one Article transaction. Optional mention, notification and subscription
  jobs are scheduled only after commit.

  ## Examples

      CMS.Comments.Writer.create(community, :post, article_id, body, user)

  """
  @spec create(T.thread(), T.article(), String.t(), User.t()) :: T.domain_res(map())
  def create(thread, article, body, %User{} = user), do: create(thread, article, body, user, nil)

  @doc """
  Creates a top-level Comment from an already resolved Article identity.

  The Article is reloaded canonically inside the aggregate transaction before
  authorization or writes occur.

  ## Examples

      CMS.Comments.Writer.create(:post, post, body, actor)
  """
  @spec create(T.thread(), T.article(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(map())
  def create(thread, %Article{} = article, body, %User{} = user, command_id) do
    with {:ok, info} <- CMS.Artiment.Matcher.match_interaction(article) do
      do_create(thread, article, body, user, info, command_id)
    end
  end

  def create(thread, %{id: article_id} = projection, body, %User{} = user, command_id)
      when is_binary(article_id) do
    with %Article{thread: ^thread} = article <- Repo.get(Article, article_id),
         {:ok, info} <- CMS.Artiment.Matcher.match_interaction(article) do
      do_create(
        thread,
        article,
        body,
        user,
        info,
        command_id,
        Map.get(projection, :branch_id)
      )
    else
      nil -> {:error, CmsErrorCat.custom("article not found")}
      {:error, _reason} = error -> error
    end
  end

  defp do_create(thread, article, body, %User{} = user, info, command_id, branch_id \\ nil) do
    article = Repo.preload(article, [[author: :user], :community])

    if is_nil(command_id) do
      create_with_access(
        thread,
        article,
        branch_id,
        body,
        user,
        info,
        Ecto.UUID.generate()
      )
      |> normalize_comments_locked()
    else
      %Command{
        actor: user,
        command_id: command_id,
        operation: :comment_create,
        target: {:comment, article.id},
        params: body
      }
      |> Command.execute(
        action: fn %{params: body, command_id: command_id} ->
          with {:ok, result} <-
                 create_with_access(
                   thread,
                   article,
                   branch_id,
                   body,
                   user,
                   info,
                   command_id
                 ) do
            {:ok, result, %{result_key: result.comment.id}}
          end
        end,
        result: fn receipt -> replay_created(receipt, article, receipt.command_id) end
      )
      |> normalize_comments_locked()
    end
  end

  defp create_with_access(:doc, article, branch_id, body, user, info, command_id)
       when is_integer(branch_id) do
    Gate.Access.with_branch_check(user, :create_comment, article, branch_id, fn canonical ->
      create_new(:doc, Map.put(canonical, :branch_id, branch_id), body, user, info, command_id)
    end)
  end

  defp create_with_access(thread, article, _branch_id, body, user, info, command_id) do
    Gate.Access.with_check(user, :create_comment, article, fn canonical ->
      create_new(thread, canonical, body, user, info, command_id)
    end)
  end

  defp create_new(thread, article, body, %User{} = user, info, command_id) do
    with {:ok, comment} <- create_comment_record(body, thread, info.foreign_key, article, user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(comment.id),
         {:ok, counted_article} <- keep_article(article),
         {:ok, projected_comment} <- set_question_flag_ifneed(article, comment),
         {:ok, participant_article} <- add_participant(article, user),
         {:ok, _active_article} <- update_active_timestamp(thread, article, comment),
         {:ok, _job} <- JobPolicy.audition(projected_comment),
         :ok <- CMS.ArticleStats.record_comment_change(participant_article),
         :ok <- record_article_metric(counted_article, command_id, :comment_created),
         {:ok, _invalidation} <- invalidate_public_comments(article, thread, command_id),
         :ok <- enqueue_comment_effects(projected_comment, article, user, :created, command_id) do
      {:ok,
       %{
         comment: projected_comment,
         article: counted_article,
         command_id: command_id
       }}
    end
  end

  defp keep_article(%Article{} = article), do: {:ok, article}

  defp add_participant(%Article{} = article, _user), do: {:ok, article}

  defp replay_created(%{result_key: result_key}, article, command_id)
       when is_binary(result_key) do
    with {result_id, ""} <- Integer.parse(result_key),
         %Comment{} = comment <- Repo.get(Comment, result_id),
         {:ok, canonical_article} <- replay_article(article) do
      {:ok,
       %{
         comment: Repo.preload(comment, reply_to_comment: :author),
         article: canonical_article,
         command_id: command_id
       }}
    else
      _ ->
        {:error, CmsErrorCat.command_id_conflict()}
    end
  end

  defp replay_created(_receipt, _article, _command_id),
    do: {:error, CmsErrorCat.command_id_conflict()}

  defp replay_article(%{id: article_id}) when is_binary(article_id) do
    with %Article{} = stable <- Repo.get(Article, article_id),
         %Community{} = community <- Repo.get(Community, stable.community_id) do
      CMS.FrontDesk.article(%{
        community: community.slug,
        thread: stable.thread,
        inner_id: stable.inner_id
      })
    else
      _ -> {:error, CmsErrorCat.command_id_conflict()}
    end
  end

  defp replay_article(article) when is_struct(article) do
    case Repo.get(article.__struct__, article.id) do
      nil -> {:error, CmsErrorCat.command_id_conflict()}
      canonical -> {:ok, Repo.preload(canonical, [[author: :user], :community])}
    end
  end

  @doc """
  Creates a reply after reloading and authorizing its target Comment inside the
  parent Article aggregate transaction.

  ## Examples

      CMS.Comments.Writer.reply(parent_comment, body, actor)
  """
  @spec reply(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply(comment_or_id, body, %User{} = user), do: reply(comment_or_id, body, user, nil)

  @doc "Creates a reply using an optional idempotency command id."
  @spec reply(Comment.t() | T.id(), String.t(), User.t(), String.t() | nil) :: T.domain_res(map())
  def reply(%Comment{} = target_comment, body, %User{} = user, command_id) do
    if is_nil(command_id) do
      reply_action(
        %{actor: user, params: body, command_id: Ecto.UUID.generate()},
        target_comment
      )
      |> unwrap_one_shot_result()
      |> normalize_comments_locked()
    else
      %Command{
        actor: user,
        command_id: command_id,
        operation: :comment_reply,
        target: target_comment,
        params: body
      }
      |> Command.execute(
        action: &reply_action(&1, target_comment),
        result: &reply_result(&1, target_comment)
      )
      |> normalize_comments_locked()
    end
  end

  def reply(comment_id, body, %User{} = user, command_id) do
    with {:ok, target_comment} <- FrontDesk.comment(comment_id) do
      reply(target_comment, body, user, command_id)
    end
  end

  defp reply_action(%{actor: user, params: body, command_id: command_id}, target_comment) do
    with {:ok, result} <-
           Gate.Access.with_check(user, :reply_comment, target_comment, fn canonical, article ->
             reply_new_from_canonical(canonical, article, body, user, command_id)
           end) do
      {:ok, result, %{result_key: result.comment.id}}
    end
  end

  defp reply_result(receipt, target_comment) do
    with {:ok, article} <-
           FrontDesk.article_of(target_comment) do
      replay_created(receipt, article, receipt.command_id)
    end
  end

  defp reply_new_from_canonical(canonical, article, body, %User{} = user, command_id) do
    with replying_comment <- Repo.preload(canonical, reply_to_comment: :author),
         {:ok, thread} <- FrontDesk.thread_of(replying_comment),
         article <- Repo.preload(article, [[author: :user], :community]),
         {:ok, info} <- CMS.Artiment.Matcher.match_interaction(article),
         {:ok, result} <-
           reply_new(replying_comment, body, user, thread, info, article, command_id) do
      {:ok, result}
    end
  end

  defp reply_new(
         replying_comment,
         body,
         %User{} = user,
         thread,
         info,
         article,
         command_id
       ) do
    parent_comment = Replies.root_comment(replying_comment)

    with {:ok, replied_comment} <-
           insert_comment(body, thread, info.foreign_key, article, user, replying_comment),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(replied_comment.id),
         {:ok, counted_article} <- keep_article(article),
         {:ok, _reply_relation} <-
           ORM.create(CommentReply, %{
             comment_id: replied_comment.id,
             reply_to_comment_id: replying_comment.id
           }),
         {:ok, participant_article} <- add_participant(article, user),
         {:ok, reply_with_meta} <-
           update_reply_to_others_state(parent_comment, replying_comment, replied_comment),
         {:ok, associated_reply} <- associate_reply(reply_with_meta, replying_comment),
         {:ok, _embedded_parent} <- add_replies_ifneed(parent_comment, associated_reply),
         {:ok, _parent} <- ORM.inc(parent_comment, :replies_count),
         {:ok, _job} <- JobPolicy.audition(associated_reply),
         :ok <- CMS.ArticleStats.apply_comment_counts(participant_article),
         :ok <- record_article_metric(counted_article, command_id, :comment_created),
         {:ok, _invalidation} <- invalidate_public_comments(article, thread, command_id),
         :ok <- enqueue_comment_effects(associated_reply, article, user, :replied, command_id) do
      {:ok,
       %{
         comment: associated_reply,
         article: counted_article,
         command_id: command_id
       }}
    end
  end

  @doc """
  Refreshes the question-category projection for every Comment under one Post.

  ## Examples

      CMS.Comments.Writer.batch_update_question_flag(post, true)
  """
  @spec batch_update_question_flag(Article.t(), boolean()) :: T.domain_res(term())
  def batch_update_question_flag(%Article{thread: :post} = article, is_question) do
    from(c in Comment, where: c.article_id == ^article.id)
    |> Repo.update_all(set: [is_for_question: is_question])
    |> done()
  end

  defp set_question_flag_ifneed(%Article{id: article_id, thread: :post}, %Comment{} = comment) do
    question_type = @article_cat.qa

    cat =
      Repo.one(
        from(state in PostState, where: state.article_id == ^article_id, select: state.cat)
      )

    case cat do
      ^question_type ->
        ORM.update(comment, %{is_for_question: true})

      _ ->
        ORM.update(comment, %{is_for_question: false})
    end
  end

  defp set_question_flag_ifneed(_, comment), do: {:ok, comment}

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
        community_id: article.community_id,
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

      attrs = put_comment_identity(attrs, article, foreign_key)
      Comment |> ORM.create(attrs)
    end
  end

  defp put_comment_identity(attrs, %{__struct__: Article, id: article_id} = article, :article_id),
    do:
      attrs
      |> Map.put(:article_id, article_id)
      |> Map.put(:branch_id, Map.get(article, :branch_id))

  defp create_comment_record(body, thread, foreign_key, article, user) do
    case insert_comment(body, thread, foreign_key, article, user) do
      {:ok, comment} -> {:ok, comment}
      {:error, details} -> create_comment(details)
    end
  end

  defp update_active_timestamp(_thread, _article, %Comment{is_article_author: true}),
    do: {:ok, :pass}

  defp update_active_timestamp(thread, article, %Comment{}),
    do: CMS.Articles.update_active_timestamp(thread, article)

  defp associate_reply(replied_comment, replying_comment) do
    replied_comment
    |> Repo.preload(:reply_to_comment)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:reply_to_comment, replying_comment)
    |> Repo.update()
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
        {:ok, replied_comment}
    end
  end

  defp record_article_metric(article, operation_id, metric) do
    case MetricEvent.append_article_action(article, operation_id, metric) do
      :ok -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, thread, command_id) do
    CMS.Outbox.send(%{
      event: "comment.changed",
      worker: CMS.Outbox.Workers.Comment.Cleanup,
      resource_type: "article",
      resource_id: article.id,
      command_id: command_id,
      data: %{
        community: article.community.slug,
        community_id: article.community_id,
        thread: thread,
        inner_id: article.inner_id,
        article_id: article.id
      }
    })
  end

  defp enqueue_comment_effects(comment, article, %User{} = actor, action, command_id) do
    case CMS.Outbox.send(%{
           event: "comment.#{action}",
           worker: CMS.Outbox.Workers.Comment.Cleanup,
           resource_type: "comment",
           resource_id: comment.id,
           command_id: command_id,
           data: %{article_id: article.id, actor_id: actor.id, community_id: article.community_id}
         }) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp article_comments_locked(details),
    do: {:error, GateErrorCat.article_comments_locked(details)}

  defp normalize_comments_locked(
         {:error, ErrorCat.error_pattern(reason: :article_comments_locked)}
       ),
       do: article_comments_locked("this article is forbid comment")

  defp normalize_comments_locked(result), do: result

  defp unwrap_one_shot_result({:ok, result, _receipt_metadata}), do: {:ok, result}
  defp unwrap_one_shot_result(result), do: result

  defp create_comment(details), do: {:error, ErrorCat.create_comment(details)}
end
