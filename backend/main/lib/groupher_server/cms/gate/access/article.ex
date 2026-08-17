defmodule GroupherServer.CMS.Gate.Access.Article do
  @moduledoc """
  Action admission for a loaded Article and its loaded Lifecycle context.

  Passport continues to own role/action authorization at the API boundary.
  This module owns the final resource-state admission that must remain true at
  the point the command mutates the Article or one of its Comments.

  Business position:

      loaded Article + Context
        -> Gate Access
        -> lifecycle admission
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.{Communities}
  alias GroupherServer.CMS.Gate.Allow
  alias GroupherServer.CMS.Model.Community

  @actions [
    :publish,
    :edit,
    :create_comment,
    :delete,
    :restore,
    :restore_snapshot,
    :upvote,
    :emotion,
    :collect
  ]

  @spec evaluate(User.t() | nil, atom(), map(), map()) :: {:ok, boolean()} | {:error, atom()}
  def evaluate(%User{} = _user, action, article, context)
      when action in @actions and is_map(article) and is_map(context),
      do: evaluate_allowed(action, article, context)

  def evaluate(:operations, action, article, context)
      when action in @actions and is_map(article) and is_map(context),
      do: evaluate_allowed(action, article, context)

  def evaluate(nil, action, _article, _context) when action in @actions, do: {:ok, false}
  def evaluate(_user, _action, _article, _context), do: {:error, :unknown_action}

  defp evaluate_allowed(action, article, context) do
    with {:ok, lifecycle} <- article_lifecycle(context),
         {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         :ok <- doc_branch_allowed(action, context),
         :ok <- action_allowed(action, lifecycle, article) do
      {:ok, true}
    else
      {:ok, false} -> {:error, :ancestor_community_not_writable}
      {:error, _reason} = error -> error
    end
  end

  defp doc_branch_allowed(action, %{doc_branch: %{type: type}})
       when action in [:upvote, :emotion, :collect] and type != :main,
       do: {:error, :article_not_mutable}

  defp doc_branch_allowed(_action, _context), do: :ok

  @spec evaluate_result(User.t() | nil, atom(), map(), map()) ::
          {:ok, true} | {:error, atom()}
  def evaluate_result(user, action, article, context) do
    case evaluate(user, action, article, context) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, reason} -> {:error, reason}
    end
  end

  defp article_lifecycle(%{article_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}

  defp article_lifecycle(_context), do: {:error, :lifecycle_not_loaded}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, :lifecycle_not_loaded}

  defp action_allowed(:publish, %{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:publish, %{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:publish, %{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:publish, %{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  # Editing an existing public Article and updating its editor Draft share the
  # same logical lifecycle. Keep this separate from :publish so both write
  # entry points reject a non-writable ancestor before touching Draft rows.
  defp action_allowed(:edit, %{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:edit, %{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:edit, %{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:edit, %{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(:create_comment, %{state: :published}, article) do
    case Allow.comment(article) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp action_allowed(:create_comment, %{state: :archived}, _article),
    do: {:error, :ancestor_article_archived}

  defp action_allowed(:create_comment, %{state: :deleted}, _article),
    do: {:error, :ancestor_article_deleted}

  defp action_allowed(:create_comment, %{state: :destroy}, _article),
    do: {:error, :ancestor_article_destroyed}

  # Article interactions are mutation actions, not read-side decoration. Phase
  # 1 deliberately denies both add and remove unless the Article is public and
  # its Community remains writable; a future undo-only policy must be explicit.
  defp action_allowed(action, %{state: :published}, _article)
       when action in [:upvote, :emotion, :collect],
       do: :ok

  defp action_allowed(action, %{state: :archived}, _article)
       when action in [:upvote, :emotion, :collect],
       do: {:error, :article_archived}

  defp action_allowed(action, %{state: :deleted}, _article)
       when action in [:upvote, :emotion, :collect],
       do: {:error, :article_deleted}

  defp action_allowed(action, %{state: :destroy}, _article)
       when action in [:upvote, :emotion, :collect],
       do: {:error, :article_destroyed}

  defp action_allowed(:delete, %{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:delete, %{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:delete, %{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:delete, %{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(:restore, %{state: :deleted}, _article), do: :ok
  defp action_allowed(:restore, _lifecycle, _article), do: {:error, :article_not_deleted}

  defp action_allowed(:restore_snapshot, %{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:restore_snapshot, %{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:restore_snapshot, %{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:restore_snapshot, %{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(_action, _lifecycle, _article), do: {:error, :article_not_mutable}
end
