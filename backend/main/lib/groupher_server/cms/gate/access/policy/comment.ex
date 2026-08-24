defmodule GroupherServer.CMS.Gate.Access.Policy.Comment do
  @moduledoc """
  Effective mutation admission for a loaded Comment.

  A Comment inherits the write capability of its parent Article and Community;
  neither ancestor state is copied into the Comment Lifecycle row.

  Business position:

      loaded Comment + Context
        -> Gate Access
        -> effective lifecycle admission

  Example contract:

      Access.Policy.comment(actor, :edit, comment, %Context.Access.Comment{})
      #=> :ok | {:error, reason}
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities
  alias GroupherServer.CMS.Communities.Enable
  alias GroupherServer.CMS.Gate.Context.Access.Comment, as: CommentContext
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.{CommentLifecycle, Community}

  @actions [
    :reply_comment,
    :edit,
    :delete,
    :upvote,
    :emotion,
    :report,
    :pin,
    :accept_solution,
    :revoke_solution
  ]

  @doc "Checks Comment mutation admission without loading or locking resources."
  @spec check_access(User.t() | nil, atom(), map(), CommentContext.t()) ::
          :ok | {:error, GroupherServer.ErrorCat.Error.t()}
  def check_access(%User{} = user, action, _comment, %CommentContext{} = context)
      when action in @actions do
    with {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         :ok <- article_mutable(context),
         :ok <- comment_mutable(context),
         :ok <- action_allowed(user, action, context) do
      :ok
    else
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, _reason} = error -> error
    end
  end

  def check_access(nil, action, _comment, _context) when action in @actions,
    do: {:error, ErrorCat.permission_denied()}

  def check_access(_user, _action, _comment, _context), do: {:error, ErrorCat.unknown_action()}

  defp article_mutable(%{article_lifecycle: %{state: :published}}), do: :ok

  defp article_mutable(%{article_lifecycle: %{state: :archived}}),
    do: {:error, ErrorCat.ancestor_article_archived()}

  defp article_mutable(%{article_lifecycle: %{state: :deleted}}),
    do: {:error, ErrorCat.ancestor_article_deleted()}

  defp article_mutable(%{article_lifecycle: %{state: :destroy}}),
    do: {:error, ErrorCat.ancestor_article_destroyed()}

  defp article_mutable(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp article(%{article: article}) when is_map(article), do: {:ok, article}
  defp article(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :visible}}), do: :ok

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :deleted}}),
    do: {:error, ErrorCat.comment_deleted()}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :destroy}}),
    do: {:error, ErrorCat.comment_destroyed()}

  defp comment_mutable(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp action_allowed(_user, :reply_comment, context) do
    with {:ok, article} <- article(context),
         {:ok, _} <- Enable.comment?(article) do
      :ok
    end
  end

  defp action_allowed(%User{id: actor_id}, action, %{
         article_author_user_id: actor_id,
         article_cat: :qa
       })
       when action in [:accept_solution, :revoke_solution] do
    :ok
  end

  defp action_allowed(_user, action, %{article_cat: :qa})
       when action in [:accept_solution, :revoke_solution],
       do: {:error, ErrorCat.permission_denied()}

  defp action_allowed(_user, action, _context)
       when action in [:accept_solution, :revoke_solution],
       do: {:error, ErrorCat.solution_not_supported()}

  defp action_allowed(_user, action, _context)
       when action in [:edit, :delete, :upvote, :emotion, :report, :pin],
       do: :ok
end
