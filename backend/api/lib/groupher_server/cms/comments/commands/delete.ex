defmodule GroupherServer.CMS.Comments.Commands.Delete do
  @moduledoc """
  Soft-deletes a Comment and reconciles the current Post solution atomically.

      target Comment
        -> Gate authorization + parent aggregate transaction/lock
        -> if current solution: revoke binding + solution Activity
        -> remove independent pin -> transition Lifecycle -> tombstone body
        -> commit -> enqueue search metrics projection

  A future physical hard-destroy command remains a separate operation; its
  foreign-key cascade semantics are not simulated here.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Articles.Bindings
  alias CMS.ArtimentMentions.GraphRevision
  alias CMS.Comments.{Lifecycle, ErrorCat, Persist, Solution}
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
  alias CMS.Comments.Effects
  alias CMS.Model.{Article, Comment, Community, PinnedComment}

  alias Helper.{ORM, T}

  @delete_hint Comment.delete_hint()

  @type result :: %{comment: Comment.t(), article: struct(), command_id: String.t()}

  @doc """
  Soft-deletes one authorized Comment without leaving a live solution binding.

  ## Examples

      Delete.execute(comment, actor)
      #=> {:ok, %{comment: %Comment{}, article: article, command_id: id}} | {:error, reason}
  """
  @spec execute(Comment.t(), User.t()) :: T.domain_res(result())
  def execute(%Comment{}, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Deletes a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), User.t(), String.t()) :: T.domain_res(result())
  def execute(%Comment{} = comment, %User{} = actor, command_id) do
    with {:ok, %Community{} = community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      execute(comment, actor, command_id, community)
    end
  end

  @doc "Deletes a Comment through the Community named by the public request path."
  def execute(%Comment{} = comment, %User{} = actor, command_id, %Community{} = community) do
    execute_pipeline(comment, actor, command_id, community)
  end

  @pipeline operation: :comment_delete,
            confirmation: Confirmation,
            target: :comment,
            params: []

  receipt_pipeline execute_pipeline(comment, actor, command_id, community) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :delete, candidate, community)
    end)

    change(fn {canonical, article} -> delete_new(canonical, article, actor, command_id) end)
    confirm(fn result -> {:ok, confirmation(result)} end)
    present(fn confirmation -> delete_result(confirmation, comment.id, community) end)
  end

  defp delete_result(%Confirmation{data: data}, comment_id, community) do
    delete_result(%{command_id: data["command_id"]}, comment_id, community)
  end

  defp delete_result(receipt, comment_id, community) do
    with {:ok, current} <- ORM.find(Comment, comment_id),
         {:ok, binding} <- FrontDesk.resolve_binding(current.article_id, community.id),
         {:ok, thread} <- FrontDesk.thread_of(current),
         {:ok, article} <-
           FrontDesk.article(%{
             community: community.slug,
             thread: thread,
             inner_id: binding.inner_id
           }) do
      {:ok,
       %{
         comment: GroupherServer.Repo.preload(current, :body),
         article: article,
         command_id: receipt.command_id
       }}
    end
  end

  defp delete_new(%Comment{} = comment, article, actor, command_id) do
    occurred_at = DateTime.utc_now(:second)

    with {:ok, _} <- ensure_not_archived(comment) do
      delete_new(comment, actor, article, command_id, occurred_at)
    end
  end

  defp delete_new(comment, actor, article, command_id, occurred_at) do
    operation_ref = command_id

    with {:ok, _} <- revoke_if_current(article, comment, actor, operation_ref, occurred_at),
         {:ok, _} <- ORM.findby_delete(PinnedComment, %{comment_id: comment.id}),
         {:ok, :pass} <-
           CMS.Review.Requests.supersede_scope_in_transaction(
             %{type: :comment, comment_id: comment.id, community_id: nil},
             operation_ref
           ),
         {:ok, :pass} <-
           CMS.Review.Requests.supersede_scope_in_transaction(
             %{type: :comment, comment_id: comment.id, community_id: comment.origin_community_id},
             operation_ref
           ),
         {:ok, :pass} <-
           GroupherServer.AlertWall.mark_target_deleted_in_transaction(
             :comment,
             to_string(comment.id),
             command_id
           ),
         {:ok, _} <- Lifecycle.transition(comment.id, :deleted),
         {:ok, deleted} <- Persist.tombstone(comment, @delete_hint),
         {:ok, :pass} <- Effects.enqueue_deleted_mention_sync(deleted, command_id),
         {:ok, _} <- record_article_metric(article, command_id, :comment_deleted),
         {:ok, _invalidation} <-
           invalidate_public_comments(article, comment.thread, command_id),
         {:ok, :pass} <- GraphRevision.bump_for_comment(comment),
         {:ok, _} <- enqueue_delete_effects(comment, article, actor, command_id) do
      {:ok, %{comment: deleted, article: article, command_id: command_id}}
    end
  end

  defp confirmation(%{comment: comment, article: article, command_id: command_id}) do
    %Confirmation{
      data: %{
        "comment_id" => to_string(comment.id),
        "article_id" => to_string(article.id),
        "command_id" => command_id
      }
    }
  end

  defp ensure_not_archived(comment) do
    if Map.get(comment, :is_archived) == true do
      {:error, ErrorCat.archived("comment is archived, can not be edit or delete")}
    else
      {:ok, :pass}
    end
  end

  defp revoke_if_current(
         %Article{thread: :post} = post,
         comment,
         actor,
         operation_ref,
         occurred_at
       ) do
    Solution.revoke_if_current(post, comment, actor, operation_ref, occurred_at)
  end

  defp revoke_if_current(_article, _comment, _actor, _operation_ref, _occurred_at) do
    {:ok, :unchanged}
  end

  defp record_article_metric(article, operation_id, metric) do
    case GroupherServer.Analysis.metric_event_append_article_action(article, operation_id, metric) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp invalidate_public_comments(article, thread, command_id) do
    with {:ok, bindings} <- Bindings.all(article) do
      Enum.reduce_while(bindings, {:ok, :pass}, fn binding, _acc ->
        result =
          Effects.enqueue(
            "comment.changed",
            "article",
            article.id,
            command_id,
            %{
              community: binding.community.slug,
              community_id: binding.community_id,
              thread: thread,
              inner_id: binding.inner_id,
              article_id: article.id
            },
            effect_key: "comment.changed:#{binding.community_id}"
          )

        case result do
          {:ok, _event} -> {:cont, {:ok, :pass}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp enqueue_delete_effects(comment, article, actor, command_id) do
    case Effects.enqueue(
           "comment.deleted",
           "article",
           article.id,
           command_id,
           %{actor_id: actor.id, article_id: article.id, comment_id: comment.id}
         ) do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
