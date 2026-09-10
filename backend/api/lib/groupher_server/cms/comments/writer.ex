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

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Jobs, Repo}

  alias GroupherServer.CMS.Comments.ErrorCat
  alias GroupherServer.CMS.{FrontDesk, Gate}
  alias GroupherServer.CMS.Gate.ErrorCat, as: GateErrorCat
  alias GroupherServer.CMS.Artiment.Const
  alias GroupherServer.CMS.ErrorCat, as: CmsErrorCat
  alias GroupherServer.CMS.CommandReceipt

  alias GroupherServer.CMS.Comments.{
    BodyCodec,
    JobPolicy,
    Lifecycle,
    Numbering,
    Participants,
    Replies
  }

  alias GroupherServer.CMS.Model.{
    Comment,
    CommentReply,
    Community,
    Embeds,
    Post
  }

  alias GroupherServer.CMS.SearchArtiments.Indexer

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

  @spec create(T.thread(), T.article(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(map())
  @doc """
  Creates a top-level Comment from an already resolved Article identity.

  The Article is reloaded canonically inside the aggregate transaction before
  authorization or writes occur.

  ## Examples

      CMS.Comments.Writer.create(:post, post, body, actor)
  """
  def create(thread, article, body, %User{} = user, command_key) when is_struct(article) do
    with {:ok, info} <- match(thread) do
      do_create(thread, article, body, user, info, command_key)
    end
  end

  @spec create(Community.t(), T.thread(), T.id(), String.t(), User.t()) :: T.domain_res(map())
  def create(%Community{} = community, thread, article_id, body, %User{} = user),
    do: create(community, thread, article_id, body, user, nil)

  @spec create(Community.t(), T.thread(), T.id(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(map())
  @doc "Creates a top-level Comment using an optional idempotency command key."
  def create(%Community{} = community, thread, article_id, body, %User{} = user, command_key) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           FrontDesk.article(community, thread, article_id,
             preload: [[author: :user], :community]
           ) do
      do_create(thread, article, body, user, info, command_key)
    end
  end

  defp do_create(thread, article, body, %User{} = user, info, command_key) do
    article = Repo.preload(article, [[author: :user], :community])

    with {:ok, command_key} <- CommandReceipt.resolve_command_key(command_key) do
      CommandReceipt.run_user_command(
        user,
        command_key,
        "comment.create",
        Atom.to_string(thread),
        article.id,
        body,
        fn ->
          with {:ok, result} <-
                 Gate.Access.with_check(user, :create_comment, article, fn canonical ->
                   create_new(thread, canonical, body, user, info, command_key)
                 end) do
            {:ok, result, %{result_key: result.comment.id}}
          end
        end,
        fn receipt -> replay_created(receipt, article, command_key) end
      )
      |> normalize_comments_locked()
      |> sync_article_metrics()
      |> enqueue_create_followups(user, article.community)
    end
  end

  defp create_new(thread, article, body, %User{} = user, info, command_key) do
    with {:ok, comment} <- create_comment_record(body, thread, info.foreign_key, article, user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(comment.id),
         {:ok, counted_article} <- ORM.inc(article, :comments_count),
         {:ok, counted_article} <- ORM.inc(counted_article, :comments_revision),
         {:ok, projected_comment} <- set_question_flag_ifneed(article, comment),
         {:ok, _participants} <- Participants.add_to_article(article, user),
         {:ok, _active_article} <- update_active_timestamp(thread, article, comment),
         {:ok, _job} <- JobPolicy.audition(projected_comment) do
      {:ok,
       %{
         comment: projected_comment,
         article: counted_article,
         command_key: command_key,
         command_replayed: false
       }}
    end
  end

  defp replay_created(%{result_key: result_key}, article, command_key)
       when is_binary(result_key) do
    with {result_id, ""} <- Integer.parse(result_key),
         %Comment{} = comment <- Repo.get(Comment, result_id),
         canonical_article when not is_nil(canonical_article) <-
           Repo.get(article.__struct__, article.id) do
      canonical_article = Repo.preload(canonical_article, [[author: :user], :community])

      {:ok,
       %{
         comment: comment,
         article: canonical_article,
         command_key: command_key,
         command_replayed: true
       }}
    else
      _ ->
        {:error, CmsErrorCat.command_key_conflict()}
    end
  end

  defp replay_created(_receipt, _article, _command_key),
    do: {:error, CmsErrorCat.command_key_conflict()}

  @doc """
  Creates a reply after reloading and authorizing its target Comment inside the
  parent Article aggregate transaction.

  ## Examples

      CMS.Comments.Writer.reply(comment_id, body, actor)
  """
  @spec reply(T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply(comment_id, body, %User{} = user), do: reply(comment_id, body, user, nil)

  @spec reply(T.id(), String.t(), User.t(), String.t() | nil) :: T.domain_res(map())
  @doc "Creates a reply using an optional idempotency command key."
  def reply(comment_id, body, %User{} = user, command_key) do
    with {:ok, target_comment} <- FrontDesk.get(Comment, comment_id) do
      with {:ok, command_key} <- CommandReceipt.resolve_command_key(command_key) do
        CommandReceipt.run_user_command(
          user,
          command_key,
          "comment.reply",
          "comment",
          target_comment.id,
          body,
          fn ->
            with {:ok, result} <-
                   Gate.Access.with_check(user, :reply_comment, target_comment, fn canonical ->
                     reply_new_from_canonical(canonical, body, user, command_key)
                   end) do
              {:ok, result, %{result_key: result.comment.id}}
            end
          end,
          fn receipt ->
            with {:ok, article} <-
                   FrontDesk.article_of(target_comment, preload: [[author: :user], :community]) do
              replay_created(receipt, article, command_key)
            end
          end
        )
        |> normalize_comments_locked()
        |> sync_article_metrics()
        |> enqueue_reply_followups(user)
      end
    end
  end

  defp reply_new_from_canonical(canonical, body, %User{} = user, command_key) do
    with replying_comment <- Repo.preload(canonical, reply_to_comment: :author),
         {:ok, thread} <- FrontDesk.thread_of(replying_comment),
         {:ok, article} <-
           FrontDesk.article_of(replying_comment, preload: [[author: :user], :community]),
         {:ok, info} <- match(thread),
         {:ok, result} <-
           reply_new(replying_comment, body, user, thread, info, article, command_key) do
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
         command_key
       ) do
    parent_comment = Replies.root_comment(replying_comment)

    with {:ok, replied_comment} <-
           insert_comment(body, thread, info.foreign_key, article, user, replying_comment),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(replied_comment.id),
         {:ok, counted_article} <- ORM.inc(article, :comments_count),
         {:ok, counted_article} <- ORM.inc(counted_article, :comments_revision),
         {:ok, _reply_relation} <-
           ORM.create(CommentReply, %{
             comment_id: replied_comment.id,
             reply_to_comment_id: replying_comment.id
           }),
         {:ok, _participants} <- Participants.add_to_article(article, user),
         {:ok, reply_with_meta} <-
           update_reply_to_others_state(parent_comment, replying_comment, replied_comment),
         {:ok, associated_reply} <- associate_reply(reply_with_meta, replying_comment),
         {:ok, _embedded_parent} <- add_replies_ifneed(parent_comment, associated_reply),
         {:ok, _parent} <- ORM.inc(parent_comment, :replies_count),
         {:ok, _job} <- JobPolicy.audition(associated_reply) do
      {:ok,
       %{
         comment: associated_reply,
         article: counted_article,
         command_key: command_key,
         command_replayed: false
       }}
    end
  end

  @spec batch_update_question_flag(Post.t(), boolean()) :: T.domain_res(term())
  @doc """
  Refreshes the question-category projection for every Comment under one Post.

  ## Examples

      CMS.Comments.Writer.batch_update_question_flag(post, true)
  """
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
        article_hash_id: article.article_hash_id,
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

  defp create_comment_record(body, thread, foreign_key, article, user) do
    case insert_comment(body, thread, foreign_key, article, user) do
      {:ok, comment} -> {:ok, comment}
      {:error, details} -> create_comment(details)
    end
  end

  defp update_active_timestamp(thread, article, comment) do
    case comment.author_id == article.author.user.id do
      true -> {:ok, :pass}
      false -> CMS.Articles.update_active_timestamp(thread, article)
    end
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

  defp sync_article_metrics({:ok, %{article: _, command_replayed: true}} = result), do: result

  defp sync_article_metrics({:ok, %{article: article}} = result) do
    _ = Indexer.enqueue_metrics(article)
    result
  end

  defp sync_article_metrics(result), do: result

  defp enqueue_create_followups(
         {:ok, %{comment: %Comment{} = comment, command_replayed: false}} = result,
         %User{} = actor,
         %Community{} = community
       ) do
    :ok =
      Jobs.enqueue_best_effort(:sync_mentions, comment.id, fn ->
        Jobs.sync_mentions(comment)
      end)

    :ok =
      Jobs.enqueue_best_effort(:notify_comment, comment.id, fn ->
        Jobs.notify_comment(comment, actor)
      end)

    :ok =
      Jobs.enqueue_best_effort(:subscribe_community, community.id, fn ->
        Jobs.subscribe_community(community, actor)
      end)

    result
  end

  defp enqueue_create_followups({:ok, %{command_replayed: true}} = result, _actor, _community),
    do: result

  defp enqueue_create_followups(result, _actor, _community), do: result

  defp enqueue_reply_followups(
         {:ok, %{comment: %Comment{} = comment, command_replayed: false}} = result,
         %User{} = actor
       ) do
    :ok =
      Jobs.enqueue_best_effort(:sync_mentions, comment.id, fn ->
        Jobs.sync_mentions(comment)
      end)

    :ok =
      Jobs.enqueue_best_effort(:notify_reply, comment.id, fn ->
        Jobs.notify_reply(comment, actor)
      end)

    result
  end

  defp enqueue_reply_followups({:ok, %{command_replayed: true}} = result, _actor), do: result

  defp enqueue_reply_followups(result, _actor), do: result

  defp article_comments_locked(details),
    do: {:error, GateErrorCat.article_comments_locked(details)}

  defp normalize_comments_locked(
         {:error, %GroupherServer.ErrorCat.Error{reason: :article_comments_locked}}
       ),
       do: article_comments_locked("this article is forbid comment")

  defp normalize_comments_locked(result), do: result

  defp create_comment(details), do: {:error, ErrorCat.create_comment(details)}
end
