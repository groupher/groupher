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
  alias CMS.ArtimentMentions.MentionsGraphRevision, as: Revision
  alias CMS.Comments.Commands.CommentConfirmation, as: Confirmation
  alias CMS.Comments.Effects
  alias Comments.Persist
  alias CMS.Model.{Comment, Community}
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
    with {:ok, %Community{} = community} <- CMS.Comments.RequestCommunity.resolve(comment) do
      execute(comment, body_bag, expected_version, actor, command_id, community)
    end
  end

  @doc "Updates a Comment through the Community named by the public request path."
  def execute(
        %Comment{} = comment,
        body_bag,
        expected_version,
        %User{} = actor,
        command_id,
        %Community{} = community
      ) do
    execute_pipeline(comment, body_bag, expected_version, actor, command_id, community)
  end

  @pipeline operation: :comment_update,
            confirmation: Confirmation,
            target: :comment,
            params: [:body_bag, :expected_version]

  receipt_pipeline execute_pipeline(
                     comment,
                     body_bag,
                     expected_version,
                     actor,
                     command_id,
                     community
                   ) do
    gate(fn candidate ->
      CMS.Gate.check_comment_in_transaction(actor, :edit, candidate, community)
    end)

    change(fn {canonical, article} ->
      update_new(
        canonical,
        article,
        body_bag,
        expected_version,
        actor,
        command_id,
        community.id
      )
    end)

    confirm(fn result -> {:ok, confirmation(result)} end)
    present(fn confirmation -> update_result(confirmation, comment.id, community) end)
  end

  defp update_result(%Confirmation{data: data}, comment_id, community) do
    update_result(%{command_id: data["command_id"]}, comment_id, community)
  end

  defp update_result(receipt, comment_id, community) do
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

  defp update_new(canonical, article, body_bag, expected_version, actor, command_id, community_id) do
    CMS.Comments.Summary.with_change(canonical, fn ->
      update_content_new(
        canonical,
        article,
        body_bag,
        expected_version,
        actor,
        command_id,
        community_id
      )
    end)
  end

  defp update_content_new(
         canonical,
         article,
         body_bag,
         expected_version,
         actor,
         command_id,
         community_id
       ) do
    with {:ok, lifecycle} <- Comments.Lifecycle.lock(canonical.id),
         {:ok, updated} <- Persist.update_content(canonical, body_bag, expected_version),
         {:ok, _review} <-
           register_comment_review(updated, lifecycle, community_id, command_id),
         {:ok, :pass} <- Revision.bump(),
         {:ok, _} <- enqueue_comment_effects(updated, actor, command_id, community_id) do
      {:ok, %{comment: updated, article: article, command_id: command_id}}
    end
  end

  defp register_comment_review(%Comment{} = comment, lifecycle, community_id, _command_id) do
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

  defp enqueue_comment_effects(%Comment{} = comment, %User{} = actor, command_id, community_id) do
    case Effects.enqueue(
           "comment.updated",
           "comment",
           comment.id,
           command_id,
           %{actor_id: actor.id, article_id: comment.article_id, community_id: community_id}
         ) do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
