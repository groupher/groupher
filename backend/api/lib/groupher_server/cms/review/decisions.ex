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
  alias CMS.Model.Author

  @actions [:approve, :deny, :release]

  @doc "Applies one human decision for a single CMS target scope in the caller transaction."
  @spec apply_in_transaction(String.t(), String.t(), atom(), struct(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def apply_in_transaction(target_key, scope_key, action, actor, operation_ref)
      when is_binary(target_key) and is_binary(scope_key) and action in @actions and
             is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         {:ok, context} <- CMS.Review.load_for_update(target_key, scope_key),
         {:ok, :pass} <- reject_author_review(context, actor),
         attrs <- request_scope(context),
         {:ok, requests} <- CMS.Review.Requests.current_for_scope_in_transaction(attrs),
         {:ok, :pass} <- ensure_ai_finished(requests),
         {:ok, :pass} <- update_restrictions(context, action, requests, actor, operation_ref),
         {:ok, :pass} <- update_wall(requests, action, operation_ref),
         {:ok, :pass} <- CMS.Review.Requests.supersede_scope_in_transaction(attrs, operation_ref) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def apply_in_transaction(_target_key, _scope_key, _action, _actor, _operation_ref) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp reject_author_review(%{kind: :comment, target: %{author_id: author_id}}, %{id: author_id}) do
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

  defp ensure_ai_finished(requests) do
    if Enum.any?(requests, &(&1.state in [:queued, :running])) do
      {:error, CMS.ErrorCat.invalid_review_block()}
    else
      {:ok, :pass}
    end
  end

  defp request_scope(%{kind: :article, target: article, scope_key: scope_key}) do
    community_id = scope_community_id(scope_key)
    %{type: :article, article_id: article.id, community_id: community_id}
  end

  defp request_scope(%{kind: :comment, target: comment, scope_key: scope_key}) do
    %{type: :comment, comment_id: comment.id, community_id: scope_community_id(scope_key)}
  end

  defp request_scope(%{kind: :doc, target: article, case_attrs: %{branch_id: branch_id}}) do
    %{type: :doc, article_id: article.id, branch_id: branch_id}
  end

  defp request_scope(_context), do: %{}

  defp update_restrictions(context, action, requests, actor, operation_ref) do
    with {:ok, active} <- CMS.ReviewBlocks.active_for(context.lifecycle, context.scope_key),
         {:ok, :pass} <- end_blocks(context, active, action, operation_ref),
         {:ok, :pass} <- maybe_deny(context, requests, action, actor, operation_ref) do
      {:ok, :pass}
    end
  end

  defp end_blocks(context, active, action, operation_ref) do
    rows =
      Enum.filter(active, fn restriction ->
        case action do
          :approve -> restriction.type in [:awaiting_ai, :awaiting_human, :ai_suspect]
          :deny -> restriction.type in [:awaiting_ai, :awaiting_human, :ai_suspect]
          :release -> true
        end
      end)

    CMS.ReviewBlocks.end_blocks(
      context.lifecycle,
      context.scope_key,
      Enum.map(rows, & &1.id),
      operation_ref,
      "human_#{action}"
    )
  end

  defp maybe_deny(_context, _requests, action, _actor, _operation_ref)
       when action != :deny do
    {:ok, :pass}
  end

  defp maybe_deny(context, requests, :deny, _actor, operation_ref) do
    subject_ref =
      case requests do
        [request | _] -> request.subject_ref
        [] -> nil
      end

    case CMS.ReviewBlocks.apply(context.lifecycle, %{
           scope_key: context.scope_key,
           type: :manual_hold,
           artiment_review_id: Enum.find_value(requests, & &1.id),
           subject_ref: subject_ref,
           source_ref: "human:#{operation_ref}",
           source: :human,
           applied_at: DateTime.utc_now(:second)
         }) do
      {:ok, _restriction} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp update_wall(requests, action, operation_ref) do
    resolution = if action == :deny, do: "human_confirmed_violation", else: "human_cleared"

    Enum.reduce_while(requests, {:ok, :pass}, fn request, {:ok, :pass} ->
      case AlertWall.resolve_ai_source_in_transaction(request.id, resolution, operation_ref) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp scope_community_id("community:" <> id) do
    case Integer.parse(id) do
      {community_id, ""} when community_id > 0 -> community_id
      _ -> nil
    end
  end

  defp scope_community_id(_scope_key), do: nil
end
