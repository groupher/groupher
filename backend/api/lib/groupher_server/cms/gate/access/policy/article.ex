defmodule GroupherServer.CMS.Gate.Access.Policy.Article do
  @moduledoc """
  Action admission for a loaded Article and its loaded Lifecycle context.

  Passport continues to own role/action authorization at the API boundary.
  This module owns the final resource-state admission that must remain true at
  the point the command mutates the Article or one of its Comments.

  Business position:

      loaded Article + Context
        -> Gate Access
        -> lifecycle admission

  Example contract:

      Access.Policy.Article.check_access(actor, :publish, article, %Context.Access.Article{})
      #=> :ok | {:error, reason}
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User

  alias CMS.Communities

  alias CMS.Communities.Enable
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Doc, as: DocContext
  alias CMS.Gate.ErrorCat
  alias CMS.Model.Community

  @actions [
    :read,
    :publish,
    :edit,
    :discard_draft,
    :create_comment,
    :delete,
    :permanently_delete,
    :restore,
    :restore_revision_to_draft,
    :move,
    :mirror,
    :unmirror,
    :pin,
    :unpin,
    :sink,
    :undo_sink,
    :set_category,
    :set_status,
    :lock_comments,
    :unlock_comments,
    :moderate,
    :read_insights,
    :upvote,
    :emotion,
    :collect,
    :report
  ]
  @interaction_actions [:upvote, :emotion, :collect, :report]

  @doc "Checks Article or Doc mutation admission without loading or locking resources."
  @spec check_access(User.t() | nil, atom(), map(), ArticleContext.t() | DocContext.t()) ::
          :ok | {:error, ErrorCat.error()}
  def check_access(%User{} = user, action, article, context)
      when action in @actions and is_map(article) and
             (is_struct(context, ArticleContext) or is_struct(context, DocContext)) do
    check_allowed(user, action, article, context)
  end

  def check_access(:operations, action, article, context)
      when action in @actions and is_map(article) and
             (is_struct(context, ArticleContext) or is_struct(context, DocContext)) do
    check_allowed(:operations, action, article, context)
  end

  def check_access(:system, :permanently_delete, article, context)
      when is_map(article) and
             (is_struct(context, ArticleContext) or is_struct(context, DocContext)) do
    check_allowed(:operations, :permanently_delete, article, context)
  end

  def check_access(nil, :read, article, context), do: check_allowed(nil, :read, article, context)

  def check_access(nil, action, _article, _context) when action in @actions do
    {:error, ErrorCat.permission_denied()}
  end

  def check_access(_user, _action, _article, _context), do: {:error, ErrorCat.unknown_action()}

  defp check_allowed(actor, :read_insights, article, context) do
    with {:ok, lifecycle} <- article_lifecycle(context),
         true <- lifecycle.state in [:published, :archived],
         {:ok, community} <- community(context),
         true <- insights_actor?(actor, article, community) do
      :ok
    else
      _ -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp check_allowed(_actor, :read, article, context) do
    with {:ok, lifecycle} <- article_lifecycle(context),
         true <- lifecycle.state in [:published, :archived],
         true <- moderation_state(article, context) == :legal do
      :ok
    else
      _ -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp check_allowed(_actor, action, article, context) do
    with {:ok, lifecycle} <- article_lifecycle(context),
         {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         :ok <- doc_branch_allowed(action, context),
         :ok <- action_allowed(action, lifecycle, article) do
      :ok
    else
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, _reason} = error -> error
    end
  end

  defp moderation_state(_article, %DocContext{doc_branch_state: %{moderation_state: state}}) do
    state
  end

  defp moderation_state(article, %ArticleContext{}), do: Map.get(article, :moderation_state)
  defp moderation_state(article, %DocContext{}), do: Map.get(article, :moderation_state)

  defp insights_actor?(:operations, _article, _community), do: true

  defp insights_actor?(%User{id: user_id} = user, article, community) do
    owner? =
      Map.get(Map.get(article, :author, %{}), :user_id) == user_id or
        community.user_id == user_id

    if owner? do
      true
    else
      permissions =
        user
        |> Map.get(:cur_passport)
        |> Helper.PermissionRegistry.normalize_rules()

      get_in(permissions, ["global", "god"]) == true or
        get_in(permissions, [community.slug, "cms", "article.insights.read"]) == true or
        get_in(permissions, [community.slug, "root"]) == true
    end
  rescue
    _ -> false
  end

  defp insights_actor?(_actor, _article, _community), do: false

  defp doc_branch_allowed(action, %{doc_branch: %{type: type}})
       when action in @interaction_actions and type != :main do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp doc_branch_allowed(_action, _context), do: :ok

  defp article_lifecycle(%{article_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}
  defp article_lifecycle(%{doc_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}

  defp article_lifecycle(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp action_allowed(:publish, %{state: state}, _article)
       when state in [:draft_only, :published] do
    :ok
  end

  defp action_allowed(:publish, %{state: :archived}, _article) do
    {:error, ErrorCat.article_archived()}
  end

  defp action_allowed(:publish, %{state: :deleted}, _article) do
    {:error, ErrorCat.article_deleted()}
  end

  defp action_allowed(:publish, %{state: :destroy}, _article) do
    {:error, ErrorCat.article_destroyed()}
  end

  # Editing an existing public Article and updating its editor Draft share the
  # same logical lifecycle. Keep this separate from :publish so both write
  # entry points reject a non-writable ancestor before touching Draft rows.
  defp action_allowed(:edit, %{state: state}, _article)
       when state in [:draft_only, :published] do
    :ok
  end

  defp action_allowed(:edit, %{state: :archived}, _article) do
    {:error, ErrorCat.article_archived()}
  end

  defp action_allowed(:edit, %{state: :deleted}, _article) do
    {:error, ErrorCat.article_deleted()}
  end

  defp action_allowed(:edit, %{state: :destroy}, _article) do
    {:error, ErrorCat.article_destroyed()}
  end

  defp action_allowed(:discard_draft, %{state: :published}, _article), do: :ok

  defp action_allowed(:discard_draft, _lifecycle, _article) do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp action_allowed(:create_comment, %{state: :published}, article) do
    case Enable.comment?(article) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp action_allowed(:create_comment, %{state: :archived}, _article) do
    {:error, ErrorCat.ancestor_article_archived()}
  end

  defp action_allowed(:create_comment, %{state: :deleted}, _article) do
    {:error, ErrorCat.ancestor_article_deleted()}
  end

  defp action_allowed(:create_comment, %{state: :destroy}, _article) do
    {:error, ErrorCat.ancestor_article_destroyed()}
  end

  # Article interactions are mutation actions, not read-side decoration. Phase
  # 1 deliberately denies both add and remove unless the Article is public and
  # its Community remains writable; a future undo-only policy must be explicit.
  defp action_allowed(action, %{state: :published}, _article)
       when action in @interaction_actions do
    :ok
  end

  defp action_allowed(action, %{state: :archived}, _article)
       when action in @interaction_actions do
    {:error, ErrorCat.article_archived()}
  end

  defp action_allowed(action, %{state: :deleted}, _article)
       when action in @interaction_actions do
    {:error, ErrorCat.article_deleted()}
  end

  defp action_allowed(action, %{state: :destroy}, _article)
       when action in @interaction_actions do
    {:error, ErrorCat.article_destroyed()}
  end

  defp action_allowed(:delete, %{state: state}, _article)
       when state in [:draft_only, :published] do
    :ok
  end

  defp action_allowed(:delete, %{state: :archived}, _article) do
    {:error, ErrorCat.article_archived()}
  end

  defp action_allowed(:delete, %{state: :deleted}, _article) do
    {:error, ErrorCat.article_deleted()}
  end

  defp action_allowed(:delete, %{state: :destroy}, _article) do
    {:error, ErrorCat.article_destroyed()}
  end

  defp action_allowed(:restore, %{state: :deleted}, _article), do: :ok

  defp action_allowed(:restore, _lifecycle, _article) do
    {:error, ErrorCat.article_not_deleted()}
  end

  defp action_allowed(:permanently_delete, %{state: :deleted}, _article), do: :ok

  defp action_allowed(:permanently_delete, _lifecycle, _article) do
    {:error, ErrorCat.article_not_deleted()}
  end

  defp action_allowed(:restore_revision_to_draft, %{state: state}, _article)
       when state in [:draft_only, :published] do
    :ok
  end

  defp action_allowed(:restore_revision_to_draft, %{state: :archived}, _article) do
    {:error, ErrorCat.article_archived()}
  end

  defp action_allowed(:restore_revision_to_draft, %{state: :deleted}, _article) do
    {:error, ErrorCat.article_deleted()}
  end

  defp action_allowed(:restore_revision_to_draft, %{state: :destroy}, _article) do
    {:error, ErrorCat.article_destroyed()}
  end

  defp action_allowed(action, %{state: state}, %{thread: thread})
       when action in [:move, :mirror, :unmirror, :pin, :unpin] and
              state in [:draft_only, :published] and thread in [:post, :blog, :changelog] do
    :ok
  end

  defp action_allowed(action, _lifecycle, _article)
       when action in [:move, :mirror, :unmirror, :pin, :unpin] do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp action_allowed(action, %{state: state}, _article)
       when action in [
              :sink,
              :undo_sink,
              :set_category,
              :set_status,
              :lock_comments,
              :unlock_comments,
              :moderate
            ] and state in [:draft_only, :published] do
    :ok
  end

  defp action_allowed(_action, _lifecycle, _article), do: {:error, ErrorCat.article_not_mutable()}
end
