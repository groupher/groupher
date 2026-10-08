defmodule GroupherServer.CMS.Comments.Writer do
  @moduledoc """
  Creation and reply orchestration for Comments writes.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Writer create/reply
        -> CMS.Gate.with_check
        -> canonical aggregate transaction + required audition job
        -> commit
        -> best-effort mention / notification / subscription jobs
  """

  require GroupherServer.CMS.Comments.ErrorCat

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.{Comments.ErrorCat, Artiment.Const, Command, FrontDesk}
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
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
      do_create(
        thread,
        article,
        body,
        user,
        info,
        command_id,
        nil,
        nil
      )
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
        Map.get(projection, :branch_id),
        Map.get(projection, :community)
      )
    else
      nil -> {:error, CmsErrorCat.custom("article not found")}
      {:error, _reason} = error -> error
    end
  end

  def create(thread, %{article_id: article_id} = projection, body, %User{} = user, command_id)
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
        Map.get(projection, :branch_id),
        Map.get(projection, :community)
      )
    else
      nil -> {:error, CmsErrorCat.custom("article not found")}
      {:error, _reason} = error -> error
    end
  end

  defp do_create(
         thread,
         article,
         body,
         %User{} = user,
         info,
         command_id,
         branch_id,
         community
       ) do
    article = Repo.preload(article, author: :user)

    if is_nil(command_id) do
      generated_command_id = Ecto.UUID.generate()

      create_with_access(
        thread,
        article,
        branch_id,
        body,
        user,
        info,
        generated_command_id,
        community
      )
      |> then(fn
        {:ok, result} ->
          with {:ok, confirmation} <- created_confirmation(result, article) do
            replay_created(confirmation, article, generated_command_id)
          end

        error ->
          error
      end)
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
                   command_id,
                   community
                 ) do
            created_confirmation(result, article)
          end
        end,
        confirmation: Confirmation
      )
      |> then(fn
        {:ok, confirmation} -> replay_created(confirmation, article, command_id)
        error -> error
      end)
      |> normalize_comments_locked()
    end
  end

  defp created_confirmation(
         %{comment: %Comment{id: comment_id}, command_id: command_id},
         %Article{id: article_id}
       ) do
    {:ok,
     %Confirmation{
       data: %{
         "comment_id" => to_string(comment_id),
         "article_id" => article_id,
         "command_id" => command_id
       }
     }}
  end

  defp created_confirmation(_result, _article) do
    {:error, CmsErrorCat.command_result_unavailable()}
  end

  defp create_with_access(:doc, article, branch_id, body, user, info, command_id, community)
       when is_integer(branch_id) do
    with %Community{} = community <- community do
      CMS.Gate.with_branch_check(
        user,
        :create_comment,
        community,
        article,
        branch_id,
        fn canonical ->
          create_new(
            :doc,
            Map.put(canonical, :branch_id, branch_id),
            body,
            user,
            info,
            command_id,
            community
          )
        end
      )
    else
      _ -> {:error, :article_binding_context_required}
    end
  end

  defp create_with_access(thread, article, _branch_id, body, user, info, command_id, community) do
    with %Community{} = community <- community do
      CMS.Gate.with_community_check(user, :create_comment, community, article, fn canonical ->
        create_new(thread, canonical, body, user, info, command_id, community)
      end)
    else
      _ -> {:error, :article_binding_context_required}
    end
  end

  defp create_new(thread, article, body, %User{} = user, info, command_id, community) do
    with {:ok, comment} <-
           create_comment_record(body, thread, info.foreign_key, article, community, user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(comment.id),
         {:ok, counted_article} <- keep_article(article),
         {:ok, projected_comment} <- set_question_flag_ifneed(article, comment),
         {:ok, participant_article} <- add_participant(article, user),
         {:ok, _active_article} <- update_active_timestamp(thread, article, comment),
         {:ok, _job} <- JobPolicy.audition(projected_comment),
         {:ok, _} <- CMS.ArticleStats.record_comment_change(participant_article),
         {:ok, _} <-
           record_article_metric(counted_article, community, command_id, :comment_created),
         {:ok, _invalidation} <-
           invalidate_public_comments(article, community, thread, command_id),
         {:ok, _} <-
           enqueue_comment_effects(
             projected_comment,
             article,
             community,
             user,
             :created,
             command_id
           ) do
      {:ok,
       %{
         comment: projected_comment,
         article: counted_article,
         community: community,
         command_id: command_id
       }}
    end
  end

  defp keep_article(%Article{} = article), do: {:ok, article}

  defp add_participant(%Article{} = article, _user), do: {:ok, article}

  defp replay_created(
         %Confirmation{data: %{"comment_id" => result_key}},
         article,
         command_id
       )
       when is_binary(result_key) do
    with {result_id, ""} <- Integer.parse(result_key),
         %Comment{} = comment <- Repo.get(Comment, result_id),
         %Community{} = community <- Repo.get(Community, comment.community_id),
         {:ok, canonical_article} <- replay_article(article) do
      {:ok,
       %{
         comment: Repo.preload(comment, reply_to_comment: :author),
         article: canonical_article,
         community: community,
         command_id: command_id
       }}
    else
      _ ->
        {:error, CmsErrorCat.command_result_unavailable()}
    end
  end

  defp replay_created(_receipt, _article, _command_id) do
    {:error, CmsErrorCat.command_result_unavailable()}
  end

  defp replay_article(
         %CMS.Articles.ArticleView{
           article_id: _article_id,
           community: %Community{} = community,
           thread: thread
         } = result
       ) do
    with {:ok, %{inner_id: inner_id}} <- CMS.Articles.Bindings.get(result, community),
         {:ok, _article} = result <-
           FrontDesk.article(%{community: community.slug, thread: thread, inner_id: inner_id}) do
      result
    else
      {:error, _reason} = error -> error
    end
  end

  defp replay_article(article) when is_struct(article) do
    case Repo.get(article.__struct__, article.id) do
      nil -> {:error, CmsErrorCat.command_result_unavailable()}
      canonical -> {:ok, Repo.preload(canonical, author: :user)}
    end
  end

  defp replay_article(%{id: article_id}) when is_binary(article_id) do
    {:error, CmsErrorCat.command_result_unavailable()}
  end

  @doc """
  Creates a reply after reloading and authorizing its target Comment inside the
  parent Article aggregate transaction.

  ## Examples

      CMS.Comments.Writer.reply(parent_comment, body, actor)
  """
  @spec reply(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply(comment_or_id, body, %User{} = user), do: reply(comment_or_id, body, user, nil)

  @doc "Creates a reply using an optional command id."
  @spec reply(Comment.t() | T.id(), String.t(), User.t(), String.t() | nil) :: T.domain_res(map())
  def reply(%Comment{} = target_comment, body, %User{} = user, command_id) do
    if is_nil(command_id) do
      reply_action(
        %{actor: user, params: body, command_id: Ecto.UUID.generate()},
        target_comment
      )
      |> then(fn
        {:ok, confirmation} -> reply_result(confirmation, target_comment)
        error -> error
      end)
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
        confirmation: Confirmation
      )
      |> then(fn
        {:ok, confirmation} -> reply_result(confirmation, target_comment)
        error -> error
      end)
      |> normalize_comments_locked()
    end
  end

  def reply(comment_id, body, %User{} = user, command_id) do
    with {:ok, target_comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      reply(target_comment, body, user, command_id)
    end
  end

  defp reply_action(%{actor: user, params: body, command_id: command_id}, target_comment) do
    with {:ok, result} <-
           CMS.Gate.with_check(user, :reply_comment, target_comment, fn canonical, article ->
             reply_new_from_canonical(canonical, article, body, user, command_id)
           end) do
      {:ok,
       %Confirmation{
         data: %{
           "comment_id" => to_string(result.comment.id),
           "article_id" => result.article.id,
           "command_id" => command_id
         }
       }}
    end
  end

  defp reply_result(%Confirmation{data: data}, target_comment) do
    with {:ok, article} <-
           FrontDesk.article_of(target_comment) do
      replay_created(
        %Confirmation{data: data},
        article,
        data["command_id"]
      )
    end
  end

  defp reply_new_from_canonical(canonical, article, body, %User{} = user, command_id) do
    with replying_comment <- Repo.preload(canonical, reply_to_comment: :author),
         {:ok, thread} <- FrontDesk.thread_of(replying_comment),
         %Community{} = community <- Repo.get(Community, replying_comment.community_id),
         article <- Repo.preload(article, author: :user),
         {:ok, info} <- CMS.Artiment.Matcher.match_interaction(article),
         {:ok, result} <-
           reply_new(
             replying_comment,
             body,
             user,
             thread,
             info,
             article,
             community,
             command_id
           ) do
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
         community,
         command_id
       ) do
    parent_comment = Replies.root_comment(replying_comment)

    with {:ok, replied_comment} <-
           insert_comment(
             body,
             thread,
             info.foreign_key,
             article,
             community,
             user,
             replying_comment
           ),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(replied_comment.id),
         {:ok, counted_article} <- keep_article(article),
         {:ok, _reply_binding} <-
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
         {:ok, _} <- CMS.ArticleStats.apply_comment_counts(participant_article),
         {:ok, _} <-
           record_article_metric(counted_article, community, command_id, :comment_created),
         {:ok, _invalidation} <-
           invalidate_public_comments(article, community, thread, command_id),
         {:ok, _} <-
           enqueue_comment_effects(
             associated_reply,
             article,
             community,
             user,
             :replied,
             command_id
           ) do
      {:ok,
       %{
         comment: associated_reply,
         article: counted_article,
         community: community,
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
         community,
         %User{id: user_id},
         reply_to_comment \\ nil
       ) do
    stable_article = struct(Article, Map.from_struct(article))

    with {:ok, payload} <- BodyCodec.parse(body),
         {:ok, _article_inner_id} <- article_inner_id(article, community),
         {:ok, inner_id} <- Numbering.next_inner_id(stable_article, foreign_key),
         {:ok, floor} <- Numbering.next_floor(stable_article, foreign_key) do
      attrs = %{
        author_id: user_id,
        community_id: community.id,
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

  defp put_comment_identity(attrs, %{__struct__: Article, id: article_id} = article, :article_id) do
    attrs
    |> Map.put(:article_id, article_id)
    |> Map.put(:branch_id, Map.get(article, :branch_id))
  end

  defp create_comment_record(body, thread, foreign_key, article, community, user) do
    case insert_comment(body, thread, foreign_key, article, community, user) do
      {:ok, comment} -> {:ok, comment}
      {:error, details} -> create_comment(details)
    end
  end

  defp update_active_timestamp(_thread, _article, %Comment{is_article_author: true}) do
    {:ok, :pass}
  end

  defp update_active_timestamp(thread, article, %Comment{}) do
    CMS.Articles.update_active_timestamp(thread, article)
  end

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

  defp record_article_metric(article, community, operation_id, metric) do
    case MetricEvent.append_article_action(article, operation_id, metric,
           community_id: community.id
         ) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, community, thread, command_id) do
    with {:ok, inner_id} <- article_inner_id(article, community) do
      CMS.Outbox.send(%{
        event: "comment.changed",
        worker: CMS.Outbox.Workers.Comment.Cleanup,
        resource_type: "article",
        resource_id: article.id,
        command_id: command_id,
        data: %{
          community: community.slug,
          community_id: community.id,
          thread: thread,
          inner_id: inner_id,
          article_id: article.id
        }
      })
    end
  end

  defp enqueue_comment_effects(
         comment,
         article,
         community,
         %User{} = actor,
         action,
         command_id
       ) do
    with {:ok, _inner_id} <- article_inner_id(article, community),
         {:ok, _event} <-
           CMS.Outbox.send(%{
             event: "comment.#{action}",
             worker: CMS.Outbox.Workers.Comment.Cleanup,
             resource_type: "comment",
             resource_id: comment.id,
             command_id: command_id,
             data: %{article_id: article.id, actor_id: actor.id, community_id: community.id}
           }) do
      {:ok, :pass}
    end
  end

  defp article_inner_id(%Article{} = article, %Community{} = community) do
    with {:ok, %{inner_id: inner_id}} <-
           CMS.Articles.Bindings.get(article, community),
         true <- is_integer(inner_id) do
      {:ok, inner_id}
    else
      _ -> {:error, CmsErrorCat.custom("article binding context required")}
    end
  end

  defp article_inner_id(_article, _community),
    do: {:error, CmsErrorCat.custom("article binding context required")}

  defp article_comments_locked(details) do
    {:error, GateErrorCat.article_comments_locked(details)}
  end

  defp normalize_comments_locked(
         {:error, ErrorCat.error_pattern(reason: :article_comments_locked)}
       ) do
    article_comments_locked("this article is forbid comment")
  end

  defp normalize_comments_locked(result), do: result

  defp create_comment(details), do: {:error, ErrorCat.create_comment(details)}
end
