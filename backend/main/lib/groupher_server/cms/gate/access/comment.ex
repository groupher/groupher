defmodule GroupherServer.CMS.Gate.Access.Comment do
  @moduledoc """
  Effective mutation admission for a loaded Comment.

  A Comment inherits the write capability of its parent Article and Community;
  neither ancestor state is copied into the Comment Lifecycle row.

  Business position:

      loaded Comment + Context
        -> Gate Access
        -> effective lifecycle admission

  Example contract:

      check_access(actor, :edit, comment, %Context.Access.Comment{})
      #=> :ok | {:error, reason}
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities
  alias GroupherServer.CMS.Communities.Enable
  alias GroupherServer.CMS.Gate.Context.Access.Comment, as: CommentContext
  alias GroupherServer.CMS.Gate.Access.Policy
  alias GroupherServer.CMS.Model.{CommentLifecycle, Community}

  @behaviour Policy

  @actions [:reply_comment, :edit, :delete, :upvote, :emotion, :pin]

  @doc "Checks Comment mutation admission without loading or locking resources."
  @spec check_access(User.t() | nil, atom(), map(), CommentContext.t()) ::
          :ok | {:error, atom()}
  @impl Policy
  def check_access(%User{} = _user, action, _comment, %CommentContext{} = context)
      when action in @actions do
    with {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         :ok <- article_mutable(context),
         :ok <- comment_mutable(context),
         :ok <- action_allowed(action, context) do
      :ok
    else
      {:ok, false} -> {:error, :ancestor_community_not_writable}
      {:error, _reason} = error -> error
    end
  end

  def check_access(nil, action, _comment, _context) when action in @actions,
    do: {:error, :permission_denied}

  def check_access(_user, _action, _comment, _context), do: {:error, :unknown_action}

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
         {:ok, _} <- Enable.comment?(article) do
      :ok
    end
  end

  defp action_allowed(action, _context) when action in [:edit, :delete, :upvote, :emotion, :pin],
    do: :ok
end
