defmodule GroupherServer.CMS.Comments.Commands.Create do
  @moduledoc """
  Creates top-level Comments and replies through `receipt_pipeline` entries.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> Comments.Commands.Create create/reply
        -> runner transaction + CMS.Gate.check_*_in_transaction
        -> canonical aggregate transaction + durable Comment effects
        -> commit
        -> best-effort mention / notification / subscription jobs
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  require GroupherServer.CMS.Comments.ErrorCat

  alias GroupherServer.{Accounts, CMS, ReviewBot}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Accounts.Model.User
  alias CMS.{Comments.ErrorCat, FrontDesk}
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
  alias CMS.Articles.Query, as: ArticleQuery
  alias CMS.Comments.{Effects, Persist, Query}
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.ErrorCat, as: CmsErrorCat

  alias CMS.Comments.{
    Lifecycle,
    Replies
  }

  alias CMS.Model.{
    Comment,
    Community,
    Article
  }

  alias Helper.T

  @pipeline operation: :comment_create,
            confirmation: Confirmation,
            target: :command_target,
            params: :body
  receipt_pipeline run_create(
                     thread,
                     article,
                     body,
                     user,
                     command_id,
                     branch_id,
                     community,
                     info,
                     command_target
                   ) do
    gate(fn _target -> authorize_create(thread, article, branch_id, user, community, info) end)

    change(fn context ->
      create_new(
        thread,
        context.article,
        body,
        user,
        context.info,
        command_id,
        context.community
      )
    end)

    confirm(fn result -> created_confirmation(result, article) end)
    present(fn confirmation -> replay_created(confirmation, article, command_id) end)
  end

  @pipeline operation: :comment_reply,
            confirmation: Confirmation,
            target: :target_comment,
            params: :body
  receipt_pipeline run_reply(target_comment, body, user, command_id) do
    gate(fn _target ->
      with {:ok, {canonical, article}} <-
             CMS.Gate.check_comment_in_transaction(user, :reply_comment, target_comment) do
        {:ok, %{comment: canonical, article: article}}
      end
    end)

    change(fn %{comment: canonical, article: article} ->
      reply_new_from_canonical(canonical, article, body, user, command_id)
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "comment_id" => to_string(result.comment.id),
           "article_id" => result.article.id,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> reply_result(confirmation, target_comment) end)
  end

  @doc "Executes the top-level Comment `receipt_pipeline`."
  @spec execute(T.thread(), map(), String.t(), User.t(), String.t() | nil) :: T.domain_res(map())
  def execute(thread, article, body, %User{} = user, command_id) when is_map(article) do
    create(thread, article, body, user, command_id)
  end

  @doc """
  Creates a top-level comment on an article identified by community, thread,
  and article id.

  Runs lifecycle creation, counters, participants and durable Comment effects
  in one Article transaction. Optional mention, notification and subscription
  jobs are scheduled only after commit.

  ## Examples

      CMS.Comments.Commands.Create.create(community, :post, article_id, body, user)

  """
  @spec create(T.thread(), T.article(), String.t(), User.t()) :: T.domain_res(map())
  def create(_thread, _article, _body, %User{}), do: {:error, CmsErrorCat.command_id_required()}

  @doc """
  Creates a top-level Comment from an already resolved Article identity.

  The Article is reloaded canonically inside the aggregate transaction before
  authorization or writes occur.

  ## Examples

      CMS.Comments.Commands.Create.create(:post, post, body, actor)
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

  def create(thread, projection, body, %User{} = user, command_id) when is_map(projection) do
    with {:ok, article_id} <- projection_article_id(projection),
         {:ok, %Article{thread: ^thread} = article} <-
           FrontDesk.article(article_id, mode: :internal),
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
      {:error, _reason} = error -> error
    end
  end

  defp projection_article_id(%{id: article_id}) when is_binary(article_id) do
    {:ok, article_id}
  end

  defp projection_article_id(%{article_id: article_id}) when is_binary(article_id) do
    {:ok, article_id}
  end

  defp projection_article_id(_projection), do: {:error, CmsErrorCat.custom("article not found")}

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
    article = ArticleQuery.article_with_author(article)

    if is_nil(command_id) do
      {:error, CmsErrorCat.command_id_required()}
    else
      run_create(
        thread,
        article,
        body,
        user,
        command_id,
        branch_id,
        community,
        info,
        {:comment, article.id}
      )
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

  defp authorize_create(:doc, article, branch_id, user, community, info)
       when is_integer(branch_id) do
    case community do
      %Community{} = community ->
        with {:ok, canonical} <-
               CMS.Gate.check_in_transaction(user, :create_comment, article, community, branch_id) do
          {:ok,
           %{article: Map.put(canonical, :branch_id, branch_id), community: community, info: info}}
        end

      _ ->
        {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp authorize_create(_thread, article, _branch_id, user, community, info) do
    case community do
      %Community{} = community ->
        with {:ok, canonical} <-
               CMS.Gate.check_in_transaction(user, :create_comment, article, community) do
          {:ok, %{article: canonical, community: community, info: info}}
        end

      _ ->
        {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp create_new(thread, article, body, %User{} = user, info, command_id, community) do
    with {:ok, comment} <-
           create_comment_record(body, thread, info.foreign_key, article, community, user),
         {:ok, lifecycle} <- Lifecycle.ensure_created(comment.id),
         {:ok, _review} <-
           register_comment_review(comment, lifecycle, community, command_id, :submit),
         {:ok, counted_article} <- keep_article(article),
         {:ok, projected_comment} <- Persist.update_question_flag(article, comment),
         {:ok, participant_article} <- add_participant(article, user),
         {:ok, _active_article} <- update_active_timestamp(thread, article, comment),
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
         {:ok, %Comment{} = comment} <-
           FrontDesk.comment(result_id, mode: :internal, view: :with_author),
         {:ok, %Community{} = community} <-
           FrontDesk.community(comment.community_id, mode: :internal),
         {:ok, canonical_article} <- replay_article(article) do
      {:ok,
       %{
         comment: Query.comment_with_reply_author(comment),
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

  defp replay_article(%Article{id: article_id}) do
    FrontDesk.article(article_id, mode: :internal, view: :with_author)
  end

  defp replay_article(%{id: article_id}) when is_binary(article_id) do
    {:error, CmsErrorCat.command_result_unavailable()}
  end

  @doc """
  Creates a reply after reloading and authorizing its target Comment inside the
  parent Article aggregate transaction.

  ## Examples

      CMS.Comments.Commands.Create.reply(parent_comment, body, actor)
  """
  @spec reply(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply(comment_or_id, body, %User{} = user), do: reply(comment_or_id, body, user, nil)

  @doc "Creates a reply using an optional command id."
  @spec reply(Comment.t() | T.id(), String.t(), User.t(), String.t() | nil) :: T.domain_res(map())
  def reply(%Comment{} = target_comment, body, %User{} = user, command_id) do
    if is_nil(command_id) do
      {:error, CmsErrorCat.command_id_required()}
    else
      run_reply(target_comment, body, user, command_id)
      |> normalize_comments_locked()
    end
  end

  def reply(comment_id, body, %User{} = user, command_id) do
    with {:ok, target_comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      reply(target_comment, body, user, command_id)
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
    with replying_comment <- Query.comment_with_reply_author(canonical),
         {:ok, thread} <- FrontDesk.thread_of(replying_comment),
         {:ok, %Community{} = community} <-
           FrontDesk.community(replying_comment.community_id, mode: :internal),
         article <- ArticleQuery.article_with_author(article),
         {:ok, info} <- CMS.Artiment.Matcher.match_interaction(article) do
      reply_new(
        replying_comment,
        body,
        user,
        thread,
        info,
        article,
        community,
        command_id
      )
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
           Persist.insert_comment(
             body,
             thread,
             info.foreign_key,
             article,
             community,
             user,
             replying_comment
           ),
         {:ok, lifecycle} <- Lifecycle.ensure_created(replied_comment.id),
         {:ok, _review} <-
           register_comment_review(replied_comment, lifecycle, community, command_id, :submit),
         {:ok, counted_article} <- keep_article(article),
         {:ok, _reply_binding} <- Persist.insert_reply_binding(replied_comment, replying_comment),
         {:ok, participant_article} <- add_participant(article, user),
         {:ok, reply_with_meta} <-
           Persist.update_reply_to_others_state(parent_comment, replying_comment, replied_comment),
         {:ok, associated_reply} <-
           Persist.associate_reply(reply_with_meta, replying_comment),
         {:ok, _embedded_parent} <-
           Persist.update_replies_embed(parent_comment, associated_reply),
         {:ok, _parent} <- Persist.increment_replies_count(parent_comment),
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

  defp create_comment_record(body, thread, foreign_key, article, community, user) do
    case Persist.insert_comment(body, thread, foreign_key, article, community, user) do
      {:ok, comment} -> {:ok, comment}
      {:error, details} -> create_comment(details)
    end
  end

  defp register_comment_review(
         %Comment{} = comment,
         lifecycle,
         %Community{id: community_id},
         _command_id,
         trigger
       ) do
    with {:ok, configs} <- ReviewBot.configs(community_id, :comment) do
      content = %{
        title: "",
        body: comment.body.plain_text,
        images: CMS.Review.Media.comment_images(comment.body.json, community_id)
      }

      target = %{
        type: :comment,
        comment_id: comment.id,
        lifecycle: lifecycle
      }

      CMS.Review.RequestSubmission.register_in_transaction(
        target,
        content,
        configs,
        if(trigger == :submit, do: :publish, else: :edit)
      )
    end
  end

  defp update_active_timestamp(_thread, _article, %Comment{is_article_author: true}) do
    {:ok, :pass}
  end

  defp update_active_timestamp(thread, article, %Comment{}) do
    CMS.Articles.update_active_timestamp(thread, article)
  end

  defp record_article_metric(article, community, operation_id, metric) do
    case GroupherServer.Analysis.metric_event_append_article_action(article, operation_id, metric,
           community_id: community.id
         ) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, community, thread, command_id) do
    with {:ok, inner_id} <- article_inner_id(article, community) do
      Effects.enqueue(
        "comment.changed",
        "article",
        article.id,
        command_id,
        %{
          community: community.slug,
          community_id: community.id,
          thread: thread,
          inner_id: inner_id,
          article_id: article.id
        }
      )
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
           Effects.enqueue(
             "comment.#{action}",
             "comment",
             comment.id,
             command_id,
             %{article_id: article.id, actor_id: actor.id, community_id: community.id}
           ) do
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

  defp article_inner_id(_article, _community) do
    {:error, CmsErrorCat.custom("article binding context required")}
  end

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
