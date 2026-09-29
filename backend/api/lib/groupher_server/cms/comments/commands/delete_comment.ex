defmodule GroupherServer.CMS.Comments.Commands.DeleteComment do
  @moduledoc """
  Soft-deletes a Comment and reconciles the current Post solution atomically.

      target Comment
        -> Gate authorization + parent aggregate transaction/lock
        -> if current solution: revoke relation + solution Activity
        -> remove independent pin -> transition Lifecycle -> tombstone body
        -> commit -> enqueue search metrics projection

  A future physical hard-destroy command remains a separate operation; its
  foreign-key cascade semantics are not simulated here.
  """

  alias GroupherServer.{Accounts, Analysis, CMS, PublicCache, Repo}

  alias Accounts.Model.User
  alias CMS.{Command, FrontDesk, Gate}
  alias CMS.Comments.{Lifecycle, ErrorCat, Commands.Solution}
  alias CMS.Model.{Comment, PinnedComment, Post}
  alias CMS.SearchArtiments.Indexer
  alias Analysis.MetricEvent
  alias Helper.{ORM, T}
  alias PublicCache.Const, as: PublicCacheConst

  @delete_hint Comment.delete_hint()

  @type result :: %{comment: Comment.t(), article: struct(), command_id: String.t()}

  @doc """
  Soft-deletes one authorized Comment without leaving a live solution relation.

  ## Examples

      DeleteComment.execute(comment, actor)
      #=> {:ok, %{comment: %Comment{}, article: article, command_id: id}} | {:error, reason}
  """
  @spec execute(Comment.t(), User.t()) :: T.domain_res(result())
  def execute(%Comment{} = comment, %User{} = actor),
    do: execute(comment, actor, nil)

  @doc "Deletes a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), User.t(), String.t() | nil) :: T.domain_res(result())
  def execute(%Comment{} = comment, %User{} = actor, command_id) do
    with {:ok, command_id} <- Command.resolve_command_id(command_id) do
      command =
        Command.update_user(actor, command_id,
          command: :comment_delete,
          resource: comment,
          input: %{},
          recovery: fn _receipt ->
            with {:ok, current} <- ORM.find(Comment, comment.id),
                 {:ok, article} <- FrontDesk.article_of(current) do
              {:ok, %{comment: current, article: article, command_id: command_id}}
            end
          end,
          after_commit: fn %{article: article} ->
            _ = Indexer.enqueue_metrics(article)
            :ok
          end
        )

      Command.run(command, fn %{resource: comment} ->
        Gate.Access.with_check(actor, :delete, comment, fn canonical, article ->
          delete_new(canonical, article, actor, command_id)
        end)
      end)
    end
  end

  defp delete_new(%Comment{} = comment, article, actor, command_id) do
    occurred_at = DateTime.utc_now(:second)

    with :ok <- ensure_not_archived(comment),
         {:ok, result} <- delete_new(comment, actor, article, command_id, occurred_at) do
      {:ok, result}
    end
  end

  defp delete_new(comment, actor, article, command_id, occurred_at) do
    operation_ref = Ecto.UUID.generate()

    with {:ok, _} <- revoke_if_current(article, comment, actor, operation_ref, occurred_at),
         {:ok, counted_article} <- ORM.dec(article, :comments_count),
         {:ok, counted_article} <- ORM.inc(counted_article, :comments_revision),
         {:ok, _} <- ORM.findby_delete(PinnedComment, %{comment_id: comment.id}),
         {:ok, _} <- Lifecycle.transition(comment.id, :deleted),
         {:ok, deleted} <- ORM.update(comment, %{body_html: @delete_hint}),
         :ok <- CMS.ArticleStats.apply_comment_counts(counted_article),
         :ok <- record_article_metric(counted_article, command_id, :comment_deleted),
         {:ok, _invalidation} <-
           invalidate_public_comments(counted_article, comment.thread, command_id) do
      {:ok, %{comment: deleted, article: counted_article, command_id: command_id}}
    end
  end

  defp ensure_not_archived(comment) do
    if Map.get(comment, :is_archived) == true,
      do: {:error, ErrorCat.archived("comment is archived, can not be edit or delete")},
      else: :ok
  end

  defp revoke_if_current(%Post{} = post, comment, actor, operation_ref, occurred_at),
    do: Solution.revoke_if_current(post, comment, actor, operation_ref, occurred_at)

  defp revoke_if_current(_article, _comment, _actor, _operation_ref, _occurred_at),
    do: {:ok, :unchanged}

  defp record_article_metric(article, operation_id, metric) do
    case MetricEvent.append_article_action(article, operation_id, metric) do
      :ok -> :ok
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, thread, command_id) do
    article = Repo.preload(article, :community)

    PublicCache.invalidate_now(
      PublicCacheConst.comments_content_changed(),
      %{
        community: article.community.slug,
        community_id: article.community_id,
        thread: thread,
        inner_id: article.inner_id,
        id: article.id
      },
      causation_id: command_id,
      aggregate_type: "article"
    )
  end
end
