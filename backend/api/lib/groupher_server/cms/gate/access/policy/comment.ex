defmodule GroupherServer.CMS.Gate.Access.Policy.Comment do
  @moduledoc """
  Effective mutation admission for a loaded Comment.

  A Comment inherits the write capability of its parent Article and Community;
  neither ancestor state is copied into the Comment Lifecycle row. Passport
  action and Comment-owner fallback are checked here so direct Commands cannot
  bypass the GraphQL middleware check.

  Business position:

      loaded Comment + Context
        -> Gate Access
        -> effective lifecycle admission

  This is the policy stage only: callers must first build the typed Access
  context, while Gate Access owns loading, transaction checks, and row locks.
  A successful decision is `{:ok, :pass}`; a denial is a typed Gate ErrorCat
  error. It does not write Lifecycle state.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Communities.Enable
  alias CMS.Gate.Context.Access.Comment, as: CommentContext
  alias CMS.Gate.ErrorCat
  alias CMS.Model.{CommentLifecycle, Community}

  @actions [
    :reply_comment,
    :edit,
    :delete,
    :upvote,
    :emotion,
    :report,
    :pin,
    :undo_pin,
    :accept_solution,
    :revoke_solution
  ]
  @solution_actions [:accept_solution, :revoke_solution]

  @doc "Checks Comment mutation admission without loading or locking resources."
  @spec check_access(User.t() | nil, atom(), map(), CommentContext.t()) ::
          {:ok, :pass} | {:error, ErrorCat.error()}
  def check_access(%User{} = user, action, _comment, %CommentContext{} = context)
      when action in @actions do
    with {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         {:ok, _} <- article_mutable(context),
         {:ok, _} <- comment_mutable(context),
         {:ok, _} <- action_allowed(user, action, context) do
      {:ok, :pass}
    else
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, _reason} = error -> error
    end
  end

  def check_access(nil, action, _comment, _context) when action in @actions do
    {:error, ErrorCat.permission_denied()}
  end

  def check_access(_user, _action, _comment, _context), do: {:error, ErrorCat.unknown_action()}

  defp article_mutable(%{article_lifecycle: %{state: :published}}), do: {:ok, :pass}

  defp article_mutable(%{article_lifecycle: %{state: :archived}}) do
    {:error, ErrorCat.ancestor_article_archived()}
  end

  defp article_mutable(%{article_lifecycle: %{state: :deleted}}) do
    {:error, ErrorCat.ancestor_article_deleted()}
  end

  defp article_mutable(%{article_lifecycle: %{state: :destroy}}) do
    {:error, ErrorCat.ancestor_article_destroyed()}
  end

  defp article_mutable(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp article(%{article: article}) when is_map(article), do: {:ok, article}
  defp article(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :visible}}), do: {:ok, :pass}

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :deleted}}) do
    {:error, ErrorCat.comment_deleted()}
  end

  defp comment_mutable(%{comment_lifecycle: %CommentLifecycle{state: :destroy}}) do
    {:error, ErrorCat.comment_destroyed()}
  end

  defp comment_mutable(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp action_allowed(_user, :reply_comment, context) do
    with {:ok, article} <- article(context),
         {:ok, _} <- Enable.comment?(article) do
      {:ok, :pass}
    end
  end

  defp action_allowed(%User{id: actor_id}, action, %{
         article_author_user_id: actor_id,
         article_cat: :qa
       })
       when action in @solution_actions do
    {:ok, :pass}
  end

  defp action_allowed(_user, action, %{article_cat: :qa})
       when action in @solution_actions do
    {:error, ErrorCat.permission_denied()}
  end

  defp action_allowed(_user, action, _context)
       when action in @solution_actions do
    {:error, ErrorCat.solution_not_supported()}
  end

  defp action_allowed(_user, action, _context)
       when action in [:upvote, :emotion, :report] do
    {:ok, :pass}
  end

  defp action_allowed(%User{} = user, action, context)
       when action in [:edit, :delete, :pin] do
    with {:ok, passport_action} <- passport_action(action),
         {:ok, community} <- community(context) do
      authorize_passport(
        user,
        passport_action,
        Map.get(context, :comment_author_user_id) == user.id,
        community,
        context
      )
    end
  end

  defp action_allowed(%User{} = user, :undo_pin, context) do
    with {:ok, community} <- community(context) do
      authorize_passport(
        user,
        CMS.GateAction.comment_undo_pin(),
        Map.get(context, :comment_author_user_id) == user.id,
        community,
        context
      )
    end
  end

  defp action_allowed(_user, _action, _context), do: {:error, ErrorCat.unknown_action()}

  defp passport_action(:edit), do: {:ok, CMS.GateAction.comment_update()}
  defp passport_action(:delete), do: {:ok, CMS.GateAction.comment_delete()}
  defp passport_action(:pin), do: {:ok, CMS.GateAction.comment_pin()}

  defp authorize_passport(user, action, owner?, community, context) do
    case CMS.GateAction.requirement(action) do
      nil ->
        {:error, ErrorCat.unknown_action()}

      requirement ->
        if owner? and Map.get(requirement, :owner_fallback, false) do
          {:ok, :pass}
        else
          passport_rules = Map.get(context, :passport_rules) || Map.get(user, :cur_passport)

          case CMS.Passport.Authorization.allowed?(passport_rules, community.slug, action) do
            {:ok, true} -> {:ok, :pass}
            {:ok, false} -> {:error, ErrorCat.permission_denied()}
            {:error, _} -> {:error, ErrorCat.permission_denied()}
          end
        end
    end
  end
end
