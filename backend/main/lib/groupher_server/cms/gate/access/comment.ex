defmodule GroupherServer.CMS.Gate.Access.Comment do
  @moduledoc """
  Effective mutation admission for a loaded Comment.

  A Comment inherits the write capability of its parent Article and Community;
  neither ancestor state is copied into the Comment Lifecycle row.

  Business position:

      loaded Comment + Context
        -> Gate Access
        -> effective lifecycle admission
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities
  alias GroupherServer.CMS.Gate.Allow
  alias GroupherServer.CMS.Model.{CommentLifecycle, Community}

  @actions [:reply_comment, :edit, :delete, :upvote, :emotion, :pin]

  @spec evaluate(User.t() | nil, atom(), map(), map()) :: {:ok, boolean()} | {:error, atom()}
  def evaluate(%User{} = _user, action, _comment, context)
      when action in @actions and is_map(context) do
    with {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         :ok <- article_mutable(context),
         :ok <- comment_mutable(context),
         :ok <- action_allowed(action, context) do
      {:ok, true}
    else
      {:ok, false} -> {:error, :ancestor_community_not_writable}
      {:error, _reason} = error -> error
    end
  end

  def evaluate(nil, action, _comment, _context) when action in @actions, do: {:ok, false}
  def evaluate(_user, _action, _comment, _context), do: {:error, :unknown_action}

  @spec evaluate_result(User.t() | nil, atom(), map(), map()) ::
          {:ok, true} | {:error, atom()}
  def evaluate_result(user, action, comment, context) do
    case evaluate(user, action, comment, context) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, reason} -> {:error, reason}
    end
  end

  defp article_mutable(%{article_lifecycle: %{state: :published}}), do: :ok

  defp article_mutable(%{article_lifecycle: %{state: :archived}}),
    do: {:error, :ancestor_article_archived}

  defp article_mutable(%{article_lifecycle: %{state: :deleted}}),
    do: {:error, :ancestor_article_deleted}

  defp article_mutable(%{article_lifecycle: %{state: :destroy}}),
    do: {:error, :ancestor_article_destroyed}

  defp article_mutable(_context), do: {:error, :lifecycle_not_loaded}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, :lifecycle_not_loaded}

  defp article(%{article: article}) when is_map(article), do: {:ok, article}
  defp article(_context), do: {:error, :lifecycle_not_loaded}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :visible}}), do: :ok

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :deleted}}),
    do: {:error, :comment_deleted}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :destroy}}),
    do: {:error, :comment_destroyed}

  defp comment_mutable(_context), do: {:error, :lifecycle_not_loaded}

  defp action_allowed(:reply_comment, context) do
    with {:ok, article} <- article(context),
         {:ok, _} <- Allow.comment(article) do
      :ok
    end
  end

  defp action_allowed(action, _context) when action in [:edit, :delete, :upvote, :emotion, :pin],
    do: :ok
end
