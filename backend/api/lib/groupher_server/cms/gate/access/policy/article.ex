defmodule GroupherServer.CMS.Gate.Access.Policy.Article do
  @moduledoc """
  Action admission for a loaded Article and its loaded Lifecycle context.

  Gate checks the current Passport action and owner fallback here, then checks
  the resource and ancestor Lifecycle facts. GraphQL middleware may reject a
  request earlier, but direct Commands use this same authoritative policy.

  Business position:

      loaded Article + Context + actor
        -> Passport action / owner fallback
        -> resource + ancestor Lifecycle
        -> allow or deny

  This is the policy stage only: callers must first build the typed Access
  context, while Gate Access owns loading, transaction checks, and row locks.
  A successful decision is `{:ok, :pass}`; a denial is a typed Gate ErrorCat
  error. It does not write Lifecycle state.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User

  alias CMS.Communities
  alias CMS.Articles.Lifecycle, as: ArticleLifecycle

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
    :import_doc,
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
    :community_tag_set,
    :community_tag_unset,
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
          {:ok, :pass} | {:error, ErrorCat.error()}
  def check_access(%User{} = user, action, article, context)
      when action in @actions and is_map(article) and
             (is_struct(context, ArticleContext) or is_struct(context, DocContext)) do
    check_allowed(user, action, article, context)
  end

  def check_access(:operations, action, article, context)
      when action in [:delete, :permanently_delete, :moderate] and is_map(article) and
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
    with {:ok, community} <- community(context),
         {:ok, :pass} <- authorize_insights(actor, article, community, context),
         {:ok, lifecycle} <- article_lifecycle(context),
         true <- lifecycle.state in [:published, :archived] do
      {:ok, :pass}
    else
      _ -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp check_allowed(actor, :read, article, context) do
    with {:ok, lifecycle} <- article_lifecycle(context),
         true <- lifecycle.state in [:published, :archived],
         true <-
           not Map.get(context, :review_restricted?, false) or article_owner?(actor, article) or
             review_scopes_readable?(actor, context) do
      {:ok, :pass}
    else
      _ -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp check_allowed(actor, action, article, context) do
    with {:ok, :pass} <- authorize_action(actor, action, article, context),
         {:ok, lifecycle} <- article_lifecycle(context),
         {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         {:ok, _} <- doc_branch_allowed(action, context),
         {:ok, _} <- action_allowed(action, lifecycle, article) do
      {:ok, :pass}
    else
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, _reason} = error -> error
    end
  end

  defp review_scopes_readable?(%User{}, context) do
    scopes = Map.get(context, :review_scope_keys, [])
    passport_rules = Map.get(context, :passport_rules)
    community = Map.get(context, :community)

    is_list(scopes) and scopes != [] and match?(%Community{}, community) and
      Enum.all?(scopes, fn
        "platform" ->
          CMS.Passport.Authorization.allowed?(
            passport_rules,
            nil,
            CMS.GateAction.review_platform_read()
          ) == {:ok, true}

        "community:" <> _community_id ->
          CMS.Passport.Authorization.allowed?(
            passport_rules,
            community.slug,
            CMS.GateAction.review_read()
          ) == {:ok, true}

        _scope ->
          false
      end)
  end

  defp authorize_insights(:operations, _article, _community, _context), do: {:ok, :pass}

  defp authorize_insights(%User{id: user_id} = user, article, community, context) do
    owner? =
      Map.get(Map.get(article, :author, %{}), :user_id) == user_id or
        community.user_id == user_id

    if owner? do
      {:ok, :pass}
    else
      authorize_passport(
        user,
        CMS.GateAction.article_insights_read(),
        false,
        community,
        nil,
        context
      )
    end
  end

  defp authorize_insights(_actor, _article, _community, _context) do
    {:error, ErrorCat.permission_denied()}
  end

  defp authorize_action(%User{} = user, action, article, context)
       when action in @interaction_actions or action == :create_comment do
    # Interaction and comment creation are authenticated-user capabilities;
    # they are not owner-only Passport actions.
    _ = {user, article, context}
    {:ok, :pass}
  end

  defp authorize_action(%User{} = user, action, article, context) do
    with {:ok, passport_action} <- passport_action(action, article, context),
         {:ok, community} <- community(context) do
      owner? = action != :moderate and article_owner?(user, article)

      authorize_passport(
        user,
        passport_action,
        owner?,
        community,
        Map.get(article, :thread),
        context
      )
    end
  end

  defp authorize_action(:operations, action, _article, _context)
       when action in [:delete, :permanently_delete, :moderate] do
    {:ok, :pass}
  end

  defp authorize_action(_actor, _action, _article, _context) do
    {:error, ErrorCat.permission_denied()}
  end

  defp authorize_passport(user, action, owner?, community, thread, context) do
    case CMS.GateAction.requirement(action) do
      nil ->
        {:error, ErrorCat.unknown_action()}

      requirement ->
        if owner? and Map.get(requirement, :owner_fallback, false) do
          {:ok, :pass}
        else
          passport_rules = Map.get(context, :passport_rules) || Map.get(user, :cur_passport)

          case CMS.Passport.Authorization.allowed?(passport_rules, community.slug, action, thread) do
            {:ok, true} -> {:ok, :pass}
            {:ok, false} -> {:error, ErrorCat.permission_denied()}
            {:error, _} -> {:error, ErrorCat.permission_denied()}
          end
        end
    end
  end

  defp passport_action(:publish, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.doc_update()}
  end

  defp passport_action(:publish, %{thread: thread}, _context)
       when thread in [:post, :blog, :changelog] do
    {:ok, "#{thread}.draft.publish"}
  end

  defp passport_action(:edit, %{thread: :doc}, _context), do: {:ok, CMS.GateAction.doc_update()}

  defp passport_action(:edit, %{thread: thread}, _context)
       when thread in [:post, :blog, :changelog] do
    {:ok, "#{thread}.update"}
  end

  defp passport_action(action, %{thread: :doc}, _context)
       when action in [:discard_draft, :restore_revision_to_draft] do
    {:ok, CMS.GateAction.doc_update()}
  end

  defp passport_action(action, %{thread: thread}, _context)
       when action in [:discard_draft, :restore_revision_to_draft] and
              thread in [:post, :blog, :changelog] do
    {:ok, "#{thread}.draft.update"}
  end

  defp passport_action(:delete, _article, _context), do: {:ok, CMS.GateAction.article_trash()}

  defp passport_action(:permanently_delete, _article, _context) do
    {:ok, CMS.GateAction.article_permanent_delete()}
  end

  defp passport_action(:restore, _article, _context), do: {:ok, CMS.GateAction.article_restore()}

  defp passport_action(:import_doc, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.doc_import()}
  end

  defp passport_action(:move, _article, _context), do: {:ok, CMS.GateAction.article_move()}
  defp passport_action(:mirror, _article, _context), do: {:ok, CMS.GateAction.article_mirror()}

  defp passport_action(:unmirror, _article, _context) do
    {:ok, CMS.GateAction.article_unmirror()}
  end

  defp passport_action(:moderate, _article, _context), do: {:ok, CMS.GateAction.article_trash()}

  defp passport_action(:community_tag_set, _article, _context) do
    {:ok, CMS.GateAction.community_tag_set()}
  end

  defp passport_action(:community_tag_unset, _article, _context) do
    {:ok, CMS.GateAction.community_tag_unset()}
  end

  defp passport_action(action, %{thread: thread}, _context)
       when thread in [:post, :blog, :changelog, :doc] do
    suffix =
      case action do
        :pin -> "pin"
        :unpin -> "undo_pin"
        :sink -> "sink"
        :undo_sink -> "undo_sink"
        :set_category -> "set_category"
        :set_status -> "set_status"
        :lock_comments -> "lock_comment"
        :unlock_comments -> "undo_lock_comment"
        _ -> nil
      end

    if is_binary(suffix) do
      {:ok, "#{thread}.#{suffix}"}
    else
      {:error, ErrorCat.unknown_action()}
    end
  end

  defp passport_action(_action, _article, _context), do: {:error, ErrorCat.unknown_action()}

  defp article_owner?(%User{id: user_id}, article) do
    Map.get(Map.get(article, :author, %{}), :user_id) == user_id
  end

  defp doc_branch_allowed(action, %{doc_branch: %{type: type}})
       when action in @interaction_actions and type != :main do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp doc_branch_allowed(_action, _context), do: {:ok, :pass}

  defp article_lifecycle(%{article_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}
  defp article_lifecycle(%{doc_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}

  defp article_lifecycle(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp action_allowed(:publish, %{state: state}, _article)
       when state in [:draft_only, :published] do
    {:ok, :pass}
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
  defp action_allowed(:edit, %{state: state} = lifecycle, _article) do
    case ArticleLifecycle.editable?(lifecycle) do
      {:ok, true} -> {:ok, :pass}
      {:ok, false} -> edit_lifecycle_error(state)
      {:error, _reason} -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  defp action_allowed(:discard_draft, %{state: :published}, _article), do: {:ok, :pass}

  defp action_allowed(:discard_draft, _lifecycle, _article) do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp action_allowed(:create_comment, %{state: :published}, article) do
    case Enable.comment?(article) do
      {:ok, _} -> {:ok, :pass}
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
    {:ok, :pass}
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
    {:ok, :pass}
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

  defp action_allowed(:restore, %{state: :deleted}, _article), do: {:ok, :pass}

  defp action_allowed(:import_doc, %{state: :deleted}, %{thread: :doc}), do: {:ok, :pass}

  defp action_allowed(:restore, _lifecycle, _article) do
    {:error, ErrorCat.article_not_deleted()}
  end

  defp action_allowed(:permanently_delete, %{state: :deleted}, _article), do: {:ok, :pass}

  defp action_allowed(:permanently_delete, _lifecycle, _article) do
    {:error, ErrorCat.article_not_deleted()}
  end

  defp action_allowed(:restore_revision_to_draft, %{state: state}, _article)
       when state in [:draft_only, :published] do
    {:ok, :pass}
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
    {:ok, :pass}
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
              :community_tag_set,
              :community_tag_unset,
              :lock_comments,
              :unlock_comments,
              :moderate
            ] and state in [:draft_only, :published] do
    {:ok, :pass}
  end

  defp action_allowed(_action, _lifecycle, _article), do: {:error, ErrorCat.article_not_mutable()}

  defp edit_lifecycle_error(:archived), do: {:error, ErrorCat.article_archived()}
  defp edit_lifecycle_error(:deleted), do: {:error, ErrorCat.article_deleted()}
  defp edit_lifecycle_error(:destroy), do: {:error, ErrorCat.article_destroyed()}
  defp edit_lifecycle_error(_state), do: {:error, ErrorCat.article_not_mutable()}
end
