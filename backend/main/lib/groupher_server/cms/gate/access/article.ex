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
  alias GroupherServer.CMS.Model.{ArticleLifecycle, Community}

  @actions [:publish, :edit, :create_comment, :delete, :restore, :restore_snapshot]

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
         :ok <- action_allowed(action, lifecycle, article) do
      {:ok, true}
    else
      {:ok, false} -> {:error, :ancestor_community_not_writable}
      {:error, _reason} = error -> error
    end
  end

  @spec evaluate_result(User.t() | nil, atom(), map(), map()) ::
          {:ok, true} | {:error, atom()}
  def evaluate_result(user, action, article, context) do
    case evaluate(user, action, article, context) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, reason} -> {:error, reason}
    end
  end

  defp article_lifecycle(%{article_lifecycle: %ArticleLifecycle{} = lifecycle}),
    do: {:ok, lifecycle}

  defp article_lifecycle(_context), do: {:error, :lifecycle_not_loaded}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, :lifecycle_not_loaded}

  defp action_allowed(:publish, %ArticleLifecycle{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:publish, %ArticleLifecycle{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:publish, %ArticleLifecycle{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:publish, %ArticleLifecycle{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  # Editing an existing public Article and updating its editor Draft share the
  # same logical lifecycle. Keep this separate from :publish so both write
  # entry points reject a non-writable ancestor before touching Draft rows.
  defp action_allowed(:edit, %ArticleLifecycle{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:edit, %ArticleLifecycle{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:edit, %ArticleLifecycle{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:edit, %ArticleLifecycle{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(:create_comment, %ArticleLifecycle{state: :published}, article) do
    case Allow.comment(article) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp action_allowed(:create_comment, %ArticleLifecycle{state: :archived}, _article),
    do: {:error, :ancestor_article_archived}

  defp action_allowed(:create_comment, %ArticleLifecycle{state: :deleted}, _article),
    do: {:error, :ancestor_article_deleted}

  defp action_allowed(:create_comment, %ArticleLifecycle{state: :destroy}, _article),
    do: {:error, :ancestor_article_destroyed}

  defp action_allowed(:delete, %ArticleLifecycle{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:delete, %ArticleLifecycle{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:delete, %ArticleLifecycle{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:delete, %ArticleLifecycle{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(:restore, %ArticleLifecycle{state: :deleted}, _article), do: :ok
  defp action_allowed(:restore, _lifecycle, _article), do: {:error, :article_not_deleted}

  defp action_allowed(:restore_snapshot, %ArticleLifecycle{state: state}, _article)
       when state in [:draft_only, :published],
       do: :ok

  defp action_allowed(:restore_snapshot, %ArticleLifecycle{state: :archived}, _article),
    do: {:error, :article_archived}

  defp action_allowed(:restore_snapshot, %ArticleLifecycle{state: :deleted}, _article),
    do: {:error, :article_deleted}

  defp action_allowed(:restore_snapshot, %ArticleLifecycle{state: :destroy}, _article),
    do: {:error, :article_destroyed}

  defp action_allowed(_action, _lifecycle, _article), do: {:error, :article_not_mutable}
end
