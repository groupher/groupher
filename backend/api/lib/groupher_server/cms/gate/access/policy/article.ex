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
  alias GroupherServer.ErrorCat, as: DomainErrors
  alias DomainErrors.Error, as: DomainError

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
    :edit_article,
    :manage_coauthors,
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
    :community_tag_set,
    :community_tag_unset,
    :community_hide,
    :community_restore,
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
  @spec check_access(User.t() | atom() | nil, atom(), ArticleContext.t() | DocContext.t()) ::
          {:ok, :pass} | {:error, ErrorCat.error()}
  def check_access(actor, action, %ArticleContext{article: article} = context)
      when is_map(article) do
    check_loaded(actor, action, article, context)
  end

  def check_access(actor, action, %DocContext{doc: doc} = context) when is_map(doc) do
    check_loaded(actor, action, doc, context)
  end

  def check_access(_actor, _action, _context), do: {:error, ErrorCat.unknown_action()}

  defp check_loaded(%User{} = user, action, article, context) when action in @actions do
    check_allowed(user, action, article, context)
  end

  defp check_loaded(:operations, action, article, context)
       when action in [:delete, :permanently_delete, :moderate] do
    check_allowed(:operations, action, article, context)
  end

  defp check_loaded(:system, :permanently_delete, article, context) do
    check_allowed(:operations, :permanently_delete, article, context)
  end

  defp check_loaded(nil, :read, article, context), do: check_allowed(nil, :read, article, context)

  defp check_loaded(nil, action, _article, _context) when action in @actions do
    {:error, ErrorCat.permission_denied()}
  end

  defp check_loaded(_user, _action, _article, _context), do: {:error, ErrorCat.unknown_action()}

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
         true <- not is_struct(context, DocContext) or context.public_available? != false,
         {:ok, true} <- public_community_readable(context),
         true <-
           not Map.get(context, :review_restricted?, false) or article_owner?(actor, article) or
             review_scopes_readable?(actor, context) do
      {:ok, :pass}
    else
      _ -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp check_allowed(actor, :manage_coauthors, article, context) do
    with {:ok, :pass} <- authorize_action(actor, :manage_coauthors, article, context),
         {:ok, lifecycle} <- article_lifecycle(context),
         {:ok, :pass} <- context_action_allowed(:manage_coauthors, lifecycle, article, context) do
      {:ok, :pass}
    else
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.article_not_mutable()}
    end
  end

  defp check_allowed(actor, action, article, context) do
    with {:ok, :pass} <- authorize_action(actor, action, article, context),
         {:ok, lifecycle} <- article_lifecycle(context),
         {:ok, community} <- community(context),
         {:ok, true} <- Communities.Lifecycle.can_write(community),
         {:ok, :pass} <- doc_trash_allowed(action, context),
         {:ok, _} <- context_action_allowed(action, lifecycle, article, context),
         {:ok, :pass} <- article_editing_allowed(action, context),
         {:ok, :pass} <- discussion_parent_readable(actor, action, article, context) do
      {:ok, :pass}
    else
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, _reason} = error -> error
    end
  end

  defp doc_trash_allowed(action, %DocContext{trashed?: true})
       when action in [:edit, :edit_article, :delete] do
    {:error, ErrorCat.article_deleted()}
  end

  defp doc_trash_allowed(_action, _context), do: {:ok, :pass}

  defp context_action_allowed(:restore, %{state: state}, _article, %DocContext{trashed?: true})
       when state in [:draft, :published, :archived, :deleted] do
    {:ok, :pass}
  end

  defp context_action_allowed(:permanently_delete, %{state: state}, _article, %DocContext{
         trashed?: true
       })
       when state in [:draft, :published, :deleted] do
    {:ok, :pass}
  end

  defp context_action_allowed(action, lifecycle, article, _context) do
    action_allowed(action, lifecycle, article)
  end

  defp public_community_readable(%DocContext{community_lifecycle: lifecycle}) do
    Communities.Lifecycle.can_read(lifecycle)
  end

  defp public_community_readable(_context), do: {:ok, true}

  defp article_editing_allowed(:edit_article, %ArticleContext{published_article_editable?: true}) do
    {:ok, :pass}
  end

  defp article_editing_allowed(
         :edit_article,
         %ArticleContext{published_article_editing_error: %DomainError{} = error}
       ) do
    {:error, error}
  end

  defp article_editing_allowed(:edit_article, %ArticleContext{}) do
    {:error, ErrorCat.published_article_editing_disabled()}
  end

  defp article_editing_allowed(_action, _context), do: {:ok, :pass}

  defp discussion_parent_readable(actor, :create_comment, article, context) do
    check_allowed(actor, :read, article, context)
  end

  defp discussion_parent_readable(_actor, _action, _article, _context), do: {:ok, :pass}

  defp review_scopes_readable?(%User{} = user, context) do
    scopes = Map.get(context, :review_scope_keys, [])
    community = Map.get(context, :community)

    is_list(scopes) and scopes != [] and match?(%Community{}, community) and
      Enum.all?(scopes, fn
        "platform" ->
          passport_allowed?(context, CMS.GateAction.review_platform_read(), nil, user, community)

        "community:" <> _community_id ->
          passport_allowed?(context, CMS.GateAction.review_read(), nil, user, community)

        _scope ->
          false
      end)
  end

  defp review_scopes_readable?(_, _context), do: false

  defp authorize_insights(:operations, _article, _community, _context), do: {:ok, :pass}

  defp authorize_insights(%User{id: user_id} = user, article, community, context) do
    _ = {user_id, article}
    authorize_passport(user, CMS.GateAction.article_insights_read(), community, nil, context)
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

  defp authorize_action(%User{} = user, :manage_coauthors, article, context) do
    with {:ok, passport_action} <- passport_action(:manage_coauthors, article, context) do
      authorize_passport(user, passport_action, nil, Map.get(article, :thread), context)
    end
  end

  defp authorize_action(%User{} = user, action, article, context) do
    with {:ok, passport_action} <- passport_action(action, article, context),
         {:ok, community} <- community(context) do
      authorize_passport(user, passport_action, community, Map.get(article, :thread), context)
    end
  end

  defp authorize_action(:operations, action, _article, _context)
       when action in [:delete, :permanently_delete, :moderate] do
    {:ok, :pass}
  end

  defp authorize_action(_actor, _action, _article, _context) do
    {:error, ErrorCat.permission_denied()}
  end

  defp authorize_passport(user, action, community, thread, context) do
    case CMS.Passport.Catalog.get(action) do
      {:error, :unknown_action} ->
        {:error, ErrorCat.unknown_action()}

      {:ok, _metadata} ->
        if passport_allowed?(context, action, thread, user, community) do
          {:ok, :pass}
        else
          {:error, ErrorCat.permission_denied()}
        end
    end
  end

  defp passport_allowed?(context, action, thread, actor, community) do
    with {:ok, %{scope: scope_kind}} <- CMS.Passport.Catalog.get(action),
         {:ok, passport_scope} <- passport_scope(context, scope_kind),
         %User{} = actor <- actor || scope_actor(passport_scope),
         {:ok, :pass} <- matching_scope(context, passport_scope, scope_kind, community),
         {:ok, true} <- allowed_passport_scope(actor, passport_scope, action, scope_kind, thread) do
      true
    else
      _ -> false
    end
  end

  defp allowed_passport_scope(actor, passport_scope, action, :article, _thread) do
    CMS.Passport.allowed?(actor, passport_scope, action)
  end

  defp allowed_passport_scope(actor, passport_scope, action, _scope, thread) do
    CMS.Passport.allowed?(actor, passport_scope, action, thread)
  end

  defp passport_scope(context, :global) do
    case Map.get(context, :passport_global_scope) do
      %CMS.Passport.Scope.Global{} = scope -> {:ok, scope}
      _ -> {:error, :scope_not_loaded}
    end
  end

  defp passport_scope(context, :community) do
    case Map.get(context, :community_passport_scope) do
      %CMS.Passport.Scope.Community{} = scope -> {:ok, scope}
      _ -> {:error, :scope_not_loaded}
    end
  end

  defp passport_scope(context, :article) do
    case Map.get(context, :article_passport_scope) do
      %CMS.Passport.Scope.Article{} = scope -> {:ok, scope}
      _ -> {:error, :scope_not_loaded}
    end
  end

  defp passport_scope(_context, _scope), do: {:error, :invalid_scope}

  defp scope_actor(%{actor_id: actor_id}), do: %User{id: actor_id}

  defp matching_scope(_context, %CMS.Passport.Scope.Global{}, :global, _community) do
    {:ok, :pass}
  end

  defp matching_scope(
         %{} = context,
         %CMS.Passport.Scope.Community{community_id: id},
         :community,
         %Community{id: id}
       ) do
    case Map.get(context, :community) do
      %Community{id: ^id} -> {:ok, :pass}
      _ -> {:error, :scope_mismatch}
    end
  end

  defp matching_scope(context, %CMS.Passport.Scope.Article{article_id: id}, :article, _community) do
    article = Map.get(context, :article) || Map.get(context, :doc)

    if is_map(article) and Map.get(article, :id) == id do
      {:ok, :pass}
    else
      {:error, :scope_mismatch}
    end
  end

  defp matching_scope(_, _, _, _), do: {:error, :scope_mismatch}

  defp passport_action(:publish, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.doc_queue_publish()}
  end

  defp passport_action(:publish, _article, _context) do
    {:ok, CMS.GateAction.article_publish()}
  end

  defp passport_action(:edit_article, %{thread: thread}, _context)
       when thread in [:post, :blog, :changelog] do
    {:ok, CMS.GateAction.article_update()}
  end

  defp passport_action(:edit_article, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.article_update()}
  end

  defp passport_action(:manage_coauthors, _article, _context) do
    {:ok, CMS.GateAction.article_author_manage()}
  end

  defp passport_action(
         action,
         %{thread: :doc},
         _context
       )
       when action in [:edit, :discard_draft, :restore_revision_to_draft] do
    {:ok, CMS.GateAction.doc_queue_write()}
  end

  defp passport_action(action, _article, _context)
       when action in [:edit, :discard_draft, :restore_revision_to_draft] do
    {:ok, CMS.GateAction.article_update()}
  end

  defp passport_action(:delete, %{thread: :doc}, _context), do: {:ok, CMS.GateAction.doc_trash()}
  defp passport_action(:delete, _article, _context), do: {:ok, CMS.GateAction.article_trash()}

  defp passport_action(:permanently_delete, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.doc_permanent_delete()}
  end

  defp passport_action(:permanently_delete, _article, _context) do
    {:ok, CMS.GateAction.article_permanent_delete()}
  end

  defp passport_action(:restore, %{thread: :doc}, _context) do
    {:ok, CMS.GateAction.doc_restore()}
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

  defp passport_action(:community_tag_set, _article, _context) do
    {:ok, CMS.GateAction.community_tag_set()}
  end

  defp passport_action(:community_tag_unset, _article, _context) do
    {:ok, CMS.GateAction.community_tag_unset()}
  end

  defp passport_action(:pin, %{thread: :post}, _), do: {:ok, CMS.GateAction.post_pin()}
  defp passport_action(:unpin, %{thread: :post}, _), do: {:ok, CMS.GateAction.post_undo_pin()}
  defp passport_action(:sink, %{thread: :post}, _), do: {:ok, CMS.GateAction.post_sink()}

  defp passport_action(:undo_sink, %{thread: :post}, _) do
    {:ok, CMS.GateAction.post_undo_sink()}
  end

  defp passport_action(:set_category, %{thread: :post}, _) do
    {:ok, CMS.GateAction.post_set_category()}
  end

  defp passport_action(:lock_comments, %{thread: :post}, _) do
    {:ok, CMS.GateAction.post_lock_comment()}
  end

  defp passport_action(:unlock_comments, %{thread: :post}, _) do
    {:ok, CMS.GateAction.post_undo_lock_comment()}
  end

  defp passport_action(:pin, %{thread: :blog}, _), do: {:ok, CMS.GateAction.blog_pin()}
  defp passport_action(:unpin, %{thread: :blog}, _), do: {:ok, CMS.GateAction.blog_undo_pin()}
  defp passport_action(:sink, %{thread: :blog}, _), do: {:ok, CMS.GateAction.blog_sink()}

  defp passport_action(:undo_sink, %{thread: :blog}, _) do
    {:ok, CMS.GateAction.blog_undo_sink()}
  end

  defp passport_action(:lock_comments, %{thread: :blog}, _) do
    {:ok, CMS.GateAction.blog_lock_comment()}
  end

  defp passport_action(:unlock_comments, %{thread: :blog}, _) do
    {:ok, CMS.GateAction.blog_undo_lock_comment()}
  end

  defp passport_action(:pin, %{thread: :changelog}, _), do: {:ok, CMS.GateAction.changelog_pin()}

  defp passport_action(:unpin, %{thread: :changelog}, _) do
    {:ok, CMS.GateAction.changelog_undo_pin()}
  end

  defp passport_action(:sink, %{thread: :changelog}, _) do
    {:ok, CMS.GateAction.changelog_sink()}
  end

  defp passport_action(:undo_sink, %{thread: :changelog}, _) do
    {:ok, CMS.GateAction.changelog_undo_sink()}
  end

  defp passport_action(:lock_comments, %{thread: :changelog}, _) do
    {:ok, CMS.GateAction.changelog_lock_comment()}
  end

  defp passport_action(:unlock_comments, %{thread: :changelog}, _) do
    {:ok, CMS.GateAction.changelog_undo_lock_comment()}
  end

  defp passport_action(:pin, %{thread: :doc}, _), do: {:ok, CMS.GateAction.doc_pin()}
  defp passport_action(:unpin, %{thread: :doc}, _), do: {:ok, CMS.GateAction.doc_undo_pin()}
  defp passport_action(:sink, %{thread: :doc}, _), do: {:ok, CMS.GateAction.doc_sink()}
  defp passport_action(:undo_sink, %{thread: :doc}, _), do: {:ok, CMS.GateAction.doc_undo_sink()}

  defp passport_action(:lock_comments, %{thread: :doc}, _) do
    {:ok, CMS.GateAction.doc_lock_comment()}
  end

  defp passport_action(:unlock_comments, %{thread: :doc}, _) do
    {:ok, CMS.GateAction.doc_undo_lock_comment()}
  end

  defp passport_action(:moderate, _article, _), do: {:ok, CMS.GateAction.community_article_hide()}

  defp passport_action(:community_hide, _article, _) do
    {:ok, CMS.GateAction.community_article_hide()}
  end

  defp passport_action(:community_restore, _article, _) do
    {:ok, CMS.GateAction.community_article_restore()}
  end

  defp passport_action(:set_category, %{thread: thread}, _)
       when thread in [:blog, :changelog, :doc] do
    {:error, ErrorCat.unknown_action()}
  end

  defp passport_action(_action, _article, _context), do: {:error, ErrorCat.unknown_action()}

  defp article_owner?(%User{id: user_id}, article) do
    Map.get(Map.get(article, :author, %{}), :user_id) == user_id
  end

  defp article_owner?(_, _article), do: false

  defp article_lifecycle(%{article_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}
  defp article_lifecycle(%{doc_lifecycle: %{state: _} = lifecycle}), do: {:ok, lifecycle}

  defp article_lifecycle(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp community(%{community: %Community{} = community}), do: {:ok, community}
  defp community(_context), do: {:error, ErrorCat.lifecycle_not_loaded()}

  defp action_allowed(:publish, %{state: state}, _article)
       when state in [:draft, :published] do
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
  defp action_allowed(action, %{state: state} = lifecycle, _article)
       when action in [:edit, :edit_article] do
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
       when state in [:draft, :published] do
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
       when state in [:draft, :published] do
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
              state in [:draft, :published] and thread in [:post, :blog, :changelog] do
    {:ok, :pass}
  end

  defp action_allowed(:manage_coauthors, %{state: state}, _article)
       when state in [:draft, :published, :archived] do
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
              :community_tag_set,
              :community_tag_unset,
              :lock_comments,
              :unlock_comments,
              :moderate
            ] and state in [:draft, :published] do
    {:ok, :pass}
  end

  defp action_allowed(:community_hide, %{state: state}, _article)
       when state in [:draft, :published] do
    {:ok, :pass}
  end

  defp action_allowed(:community_restore, %{state: state}, _article)
       when state in [:draft, :published, :archived, :deleted] do
    {:ok, :pass}
  end

  defp action_allowed(action, _lifecycle, _article)
       when action in [:community_hide, :community_restore] do
    {:error, ErrorCat.article_not_mutable()}
  end

  defp action_allowed(_action, _lifecycle, _article), do: {:error, ErrorCat.article_not_mutable()}

  defp edit_lifecycle_error(:archived), do: {:error, ErrorCat.article_archived()}
  defp edit_lifecycle_error(:deleted), do: {:error, ErrorCat.article_deleted()}
  defp edit_lifecycle_error(:destroy), do: {:error, ErrorCat.article_destroyed()}
  defp edit_lifecycle_error(_state), do: {:error, ErrorCat.article_not_mutable()}
end
