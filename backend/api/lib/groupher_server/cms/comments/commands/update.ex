defmodule GroupherServer.CMS.Comments.Commands.Update do
  @moduledoc """
  Updates Comment content inside its parent Article aggregate boundary.

      target Comment
        -> Gate authorization + aggregate transaction/lock
        -> parse body -> update canonical Comment -> sync embedded replies
        -> enqueue durable Comment effects -> commit
        -> enqueue best-effort mention reconciliation

  Solution identity is never inferred from a Comment flag. Read-side Query
  code derives it from `PostSolution`; the Comment row remains the body
  authority.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, ReviewBot}
  alias Accounts.Model.User
  alias CMS.{FrontDesk, Comments}
  alias CMS.Articles.Bindings
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
  alias CMS.Comments.Effects
  alias Comments.Persist
  alias CMS.Model.Comment
  alias Helper.{ORM, T}

  @type result :: %{comment: Comment.t(), article: struct(), command_id: String.t() | nil}

  @doc """
  Updates the authorized canonical Comment and schedules mention reconciliation
  without changing the committed mutation result.

  ## Examples

      Update.execute(comment, body, actor)
      #=> {:ok, %{comment: %Comment{}, article: article, command_id: id}} | {:error, reason}
  """
  @spec execute(Comment.t(), String.t(), User.t()) :: T.domain_res(result())
  def execute(%Comment{}, _body, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Updates a Comment while binding retries to the supplied command id."
  @spec execute(Comment.t(), map(), non_neg_integer(), User.t(), String.t()) ::
          T.domain_res(result())
  def execute(%Comment{} = comment, body_bag, expected_version, %User{} = actor, command_id) do
    execute_pipeline(comment, body_bag, expected_version, actor, command_id)
  end

  @pipeline operation: :comment_update,
            confirmation: Confirmation,
            target: :comment,
            params: [:body_bag, :expected_version]

  receipt_pipeline execute_pipeline(comment, body_bag, expected_version, actor, command_id) do
    gate(fn candidate -> CMS.Gate.check_comment_in_transaction(actor, :edit, candidate) end)

    change(fn {canonical, article} ->
      update_new(
        canonical,
        article,
        body_bag,
        expected_version,
        actor,
        command_id,
        comment.community_id
      )
    end)

    confirm(fn result -> {:ok, confirmation(result)} end)
    present(fn confirmation -> update_result(confirmation, comment.id) end)
  end

  defp update_result(%Confirmation{data: data}, comment_id) do
    update_result(%{command_id: data["command_id"]}, comment_id)
  end

  defp update_result(receipt, comment_id) do
    with {:ok, current} <- ORM.find(Comment, comment_id),
         {:ok, article} <- FrontDesk.article_of(current) do
      {:ok,
       %{
         comment: GroupherServer.Repo.preload(current, :body),
         article: article,
         command_id: receipt.command_id
       }}
    end
  end

  defp update_new(canonical, article, body_bag, expected_version, actor, command_id, community_id) do
    with {:ok, lifecycle} <- Comments.Lifecycle.lock(canonical.id),
         {:ok, updated} <- Persist.update_content(canonical, body_bag, expected_version),
         {:ok, _review} <-
           register_comment_review(updated, lifecycle, community_id, command_id),
         {:ok, _} <- CMS.ArticleStats.record_comment_change(article),
         {:ok, synced} <- CMS.Comments.Replies.sync_embed_replies(updated),
         {:ok, _invalidation} <-
           invalidate_public_comments(article, community_id, canonical.thread, command_id),
         {:ok, _} <- enqueue_comment_effects(canonical, actor, command_id) do
      {:ok, %{comment: synced, article: article, command_id: command_id}}
    end
  end

  defp register_comment_review(%Comment{} = comment, lifecycle, community_id, _command_id) do
    with {:ok, configs} <- ReviewBot.configs(community_id, :comment) do
      content = %{
        title: "",
        body: comment.body.plain_text,
        images: CMS.Review.Media.comment_images(comment.body.json, comment.community_id)
      }

      target = %{
        type: :comment,
        comment_id: comment.id,
        lifecycle: lifecycle
      }

      CMS.Review.RequestSubmission.register_in_transaction(target, content, configs, :edit)
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

  defp invalidate_public_comments(article, community_id, thread, command_id) do
    with {:ok, community} <- FrontDesk.community(community_id, mode: :internal),
         {:ok, %{community: community, inner_id: inner_id}} <- Bindings.get(article, community) do
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

  defp enqueue_comment_effects(%Comment{} = comment, %User{} = actor, command_id) do
    case Effects.enqueue(
           "comment.updated",
           "comment",
           comment.id,
           command_id,
           %{actor_id: actor.id, article_id: comment.article_id}
         ) do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
