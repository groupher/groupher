defmodule GroupherServer.CMS.Review.Decisions do
  @moduledoc """
  Applies human review decisions through CMS Lifecycle and AlertWall boundaries.

  Business position:

      CMS human decision command
        -> current request and target are locked
          -> CMS restriction update + AlertWall action
            -> one committed resource result
  """

  alias GroupherServer.{AlertWall, CMS, Repo}
  alias CMS.ArtimentMentions.MentionsGraphRevision, as: Revision
  alias CMS.Model.Author
  alias CMS.Review.Const

  @actions Const.decision_actions()

  @doc "Applies one human decision for a single CMS target scope in the caller transaction."
  @spec apply_in_transaction(String.t(), String.t(), atom(), struct(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def apply_in_transaction(target_key, scope_key, action, actor, operation_ref)
      when is_binary(target_key) and is_binary(scope_key) and is_binary(operation_ref) do
    if action in @actions do
      do_apply_in_transaction(target_key, scope_key, action, actor, operation_ref)
    else
      {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp do_apply_in_transaction(target_key, scope_key, action, actor, operation_ref) do
    with true <- Repo.in_transaction?(),
         {:ok, context} <- CMS.Review.load_for_update(target_key, scope_key),
         {:ok, :pass} <- require_platform_scope_for_shared_comment(context, scope_key),
         {:ok, :pass} <- reject_author_review(context, actor),
         attrs <- request_scope(context),
         {:ok, requests} <- CMS.Review.Requests.current_for_scope_in_transaction(attrs),
         {:ok, :pass} <- ensure_ai_finished(requests, action),
         {:ok, :pass} <- update_restrictions(context, action, requests, actor, operation_ref),
         {:ok, :pass} <- update_wall(attrs, action, operation_ref),
         {:ok, :pass} <- CMS.Review.Requests.supersede_scope_in_transaction(attrs, operation_ref),
         {:ok, :pass} <- bump_graph(context) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp require_platform_scope_for_shared_comment(
         %{type: :comment, target: %{thread: thread}},
         scope_key
       )
       when thread in [:post, :blog, :changelog] and scope_key != "platform" do
    {:error, CMS.Passport.ErrorCat.permission_denied()}
  end

  defp require_platform_scope_for_shared_comment(_context, _scope_key), do: {:ok, :pass}

  defp reject_author_review(%{type: :comment, target: %{author_id: author_id}}, %{id: author_id}) do
    {:error, CMS.Passport.ErrorCat.permission_denied()}
  end

  defp reject_author_review(%{target: %{author_id: author_id}}, %{id: user_id})
       when not is_nil(author_id) and is_integer(user_id) do
    case Repo.get(Author, author_id) do
      %Author{user_id: ^user_id} ->
        {:error, CMS.Passport.ErrorCat.permission_denied()}

      _ ->
        {:ok, :pass}
    end
  end

  defp reject_author_review(_context, _actor), do: {:ok, :pass}

  defp ensure_ai_finished(_requests, :reject), do: {:ok, :pass}

  defp ensure_ai_finished(requests, :approve) do
    if Enum.any?(requests, &(&1.state in [:queued, :running])) do
      {:error, CMS.ErrorCat.invalid_review_block()}
    else
      {:ok, :pass}
    end
  end

  defp request_scope(%{type: :article, target: article, scope_key: scope_key}) do
    community_id = scope_community_id(scope_key)
    %{type: :article, article_id: article.id, community_id: community_id}
  end

  defp request_scope(%{type: :comment, target: comment, scope_key: scope_key}) do
    %{type: :comment, comment_id: comment.id, community_id: scope_community_id(scope_key)}
  end

  defp request_scope(%{type: :doc, target: article, branch_id: branch_id}) do
    %{type: :doc, article_id: article.id, branch_id: branch_id}
  end

  defp request_scope(_context), do: %{}

  defp update_restrictions(context, action, requests, actor, operation_ref) do
    CMS.Comments.Summary.for_lifecycle(context.lifecycle, fn ->
      update_restriction_facts(context, action, requests, actor, operation_ref)
    end)
  end

  defp update_restriction_facts(context, action, requests, actor, operation_ref) do
    with {:ok, active} <-
           CMS.ReviewBlocks.active_for(context.lifecycle, restriction_scope(context)),
         {:ok, :pass} <- end_blocks(context, active, action, operation_ref),
         {:ok, :pass} <- maybe_reject(context, requests, action, actor, operation_ref) do
      {:ok, :pass}
    end
  end

  defp end_blocks(context, active, action, operation_ref) do
    rows =
      Enum.filter(active, fn restriction ->
        case action do
          :approve ->
            restriction.type in Const.restriction_types()

          :reject ->
            restriction.type in Const.automated_restriction_types()
        end
      end)

    CMS.Review.Restrictions.end_blocks(
      context.lifecycle,
      restriction_scope(context),
      Enum.map(rows, & &1.id),
      operation_ref,
      "human_#{action}"
    )
  end

  defp maybe_reject(_context, _requests, action, _actor, _operation_ref)
       when action != :reject do
    {:ok, :pass}
  end

  defp maybe_reject(context, requests, :reject, actor, operation_ref) do
    case CMS.Review.Restrictions.apply(context.lifecycle, %{
           scope_key: restriction_scope(context),
           type: :manual_hold,
           artiment_review_id: Enum.find_value(requests, & &1.id),
           operation_ref: operation_ref,
           source_ref: "human:#{operation_ref}",
           source: :human,
           actor: actor,
           applied_at: DateTime.utc_now(:second)
         }) do
      {:ok, _restriction} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp update_wall(attrs, action, operation_ref) do
    resolution = if action == :reject, do: "human_confirmed_violation", else: "human_cleared"
    AlertWall.resolve_target_in_transaction(wall_target(attrs), resolution, operation_ref)
  end

  defp restriction_scope(%{type: :comment, target: %{thread: thread}})
       when thread in [:post, :blog, :changelog] do
    "platform"
  end

  defp restriction_scope(context), do: context.scope_key

  defp bump_graph(%{type: :comment}), do: Revision.bump()
  defp bump_graph(%{target: %{id: _article_id}}), do: Revision.bump()
  defp bump_graph(_), do: {:ok, :pass}

  defp wall_target(%{type: :article, article_id: id, community_id: community_id}) do
    %{owner: :cms, target_type: :article, target_id: id, community_id: community_id}
  end

  defp wall_target(%{type: :comment, comment_id: id, community_id: community_id}) do
    %{owner: :cms, target_type: :comment, target_id: to_string(id), community_id: community_id}
  end

  defp wall_target(%{type: :doc, article_id: id, branch_id: branch_id}) do
    %{owner: :cms, target_type: :doc, target_id: "#{id}:#{branch_id}", community_id: nil}
  end

  defp scope_community_id("community:" <> id) do
    case Integer.parse(id) do
      {community_id, ""} when community_id > 0 -> community_id
      _ -> nil
    end
  end

  defp scope_community_id(_scope_key), do: nil
end
