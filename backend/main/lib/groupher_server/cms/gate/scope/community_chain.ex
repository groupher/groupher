defmodule GroupherServer.CMS.Gate.Scope.CommunityChain do
  require GroupherServer.CMS.Docs.Const
  require GroupherServer.CMS.Communities.Const
  @moduledoc """
  Compiles the public ancestor-Community boundary for CMS child resources.

  Gate owns the reserved joins. Existing Community/Lifecycle joins are rejected
  because their join predicates cannot be assumed to express the same policy.

  The exported query helpers are internal Scope query seams. Product callers use
  `CMS.Gate.scope/4` and never call this module directly.

  Business position:

      child resource query
        -> ancestor Community Scope
        -> public Community boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Communities
  alias GroupherServer.CMS.Docs.Const
  alias GroupherServer.CMS.Gate.ErrorCat

  alias GroupherServer.CMS.Model.{
    ArticleLifecycle,
    CommentLifecycle,
    Community,
    CommunityLifecycle,
    CommunityModerator,
    DocBranch,
    DocLifecycle
  }


  require Const

  @community_normal GroupherServer.CMS.Communities.Const.pending_state(:normal)
  @audit_illegal GroupherServer.CMS.Artiment.Const.moderation_state(:illegal)
  @document_public_article_states [:published, :archived]
  @document_draft_article_states [:draft_only, :published, :archived]
  @reserved_aliases [
    :gate_article,
    :gate_article_lifecycle,
    :gate_comment_lifecycle,
    :gate_community,
    :gate_community_lifecycle
  ]

  @doc false
  @spec article(Ecto.Query.t()) :: Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def article(%Ecto.Query{} = query, policy_mode \\ :public) do
    with :ok <-
           reject_conflicting_scope_joins(query, [ArticleLifecycle, Community, CommunityLifecycle]) do
      query =
        from(article in query,
          join: community in assoc(article, :community),
          as: :gate_community,
          left_join: lifecycle in CommunityLifecycle,
          as: :gate_community_lifecycle,
          on: lifecycle.community_id == community.id
        )

      apply_community_lifecycle(query, policy_mode)
    end
  end

  @doc false
  @spec direct(Ecto.Query.t()) :: Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def direct(%Ecto.Query{} = query) do
    with :ok <-
           reject_conflicting_scope_joins(query, [
             CommentLifecycle,
             ArticleLifecycle,
             Community,
             CommunityLifecycle
           ]) do
      from(resource in query,
        join: community in assoc(resource, :community),
        as: :gate_community,
        left_join: lifecycle in CommunityLifecycle,
        as: :gate_community_lifecycle,
        on: lifecycle.community_id == community.id,
        where:
          lifecycle.state in ^[:active, :read_only] or
            (is_nil(lifecycle.id) and community.pending == ^@community_normal)
      )
    end
  end

  @doc false
  @spec comment(Ecto.Query.t(), atom(), module()) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def comment(%Ecto.Query{} = query, thread, article_schema) do
    with :ok <-
           reject_conflicting_scope_joins(query, [
             article_schema,
             ArticleLifecycle,
             CommentLifecycle,
             Community,
             CommunityLifecycle
           ]) do
      from(comment in query,
        join: article in assoc(comment, ^thread),
        as: :gate_article,
        join: community in assoc(article, :community),
        as: :gate_community,
        left_join: lifecycle in CommunityLifecycle,
        as: :gate_community_lifecycle,
        on: lifecycle.community_id == community.id,
        where:
          comment.thread == ^thread and
            (lifecycle.state in ^[:active, :read_only] or
               (is_nil(lifecycle.id) and community.pending == ^@community_normal))
      )
    end
  end

  @doc false
  @spec document(Ecto.Query.t(), atom(), module(), atom(), atom(), integer() | :main | nil) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  def document(
        %Ecto.Query{} = query,
        thread,
        article_schema,
        policy_mode \\ :public,
        stage \\ :public,
        branch_ref \\ nil
      ) do
    owned_schemas =
      if thread == :doc,
        do: [article_schema, DocBranch, DocLifecycle, Community, CommunityLifecycle],
        else: [article_schema, ArticleLifecycle, Community, CommunityLifecycle]

    with :ok <- reject_conflicting_scope_joins(query, owned_schemas),
         %Ecto.Query{} = query <-
           document_ancestors(query, thread, article_schema, policy_mode, branch_ref) do
      apply_document_policy(query, policy_mode, stage)
    end
  end

  defp document_ancestors(query, :doc, article_schema, policy_mode, branch_ref) do
    with %Ecto.Query{} = query <-
           from(document in query,
             join: article in ^article_schema,
             as: :gate_article,
             on: article.id == document.article_id and document.thread == ^:doc,
             join: branch in DocBranch,
             as: :gate_doc_branch,
             on:
               branch.id == article.branch_id and
                 branch.community_id == article.community_id,
             join: lifecycle in DocLifecycle,
             as: :gate_article_lifecycle,
             on:
               lifecycle.community_id == article.community_id and
                 lifecycle.branch_id == branch.id and
                 lifecycle.article_hash_id == article.article_hash_id,
             join: community in assoc(article, :community),
             as: :gate_community,
             left_join: community_lifecycle in CommunityLifecycle,
             as: :gate_community_lifecycle,
             on: community_lifecycle.community_id == community.id
           ),
         %Ecto.Query{} = query <- doc_branch_policy(query, branch_ref, policy_mode) do
      query
    end
  end

  defp document_ancestors(query, thread, article_schema, _policy_mode, _branch_ref) do
    from(document in query,
      join: article in ^article_schema,
      as: :gate_article,
      on: article.id == document.article_id and document.thread == ^thread,
      join: article_lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on:
        article_lifecycle.community_id == article.community_id and
          article_lifecycle.thread == ^thread and
          article_lifecycle.article_hash_id == article.article_hash_id,
      join: community in assoc(article, :community),
      as: :gate_community,
      left_join: lifecycle in CommunityLifecycle,
      as: :gate_community_lifecycle,
      on: lifecycle.community_id == community.id
    )
  end

  defp doc_branch_policy(query, :main, :public) do
    from([gate_doc_branch: branch] in query,
      where: branch.type == ^Const.doc_branch_type(:main)
    )
  end

  defp doc_branch_policy(query, branch_ref, :public) when is_integer(branch_ref) do
    from([gate_doc_branch: branch] in query,
      where:
        branch.id == ^branch_ref and
          branch.type == ^Const.doc_branch_type(:main)
    )
  end

  defp doc_branch_policy(query, branch_ref, _policy_mode) when is_integer(branch_ref) do
    from([gate_doc_branch: branch] in query, where: branch.id == ^branch_ref)
  end

  defp doc_branch_policy(_query, _branch_ref, _policy_mode),
    do: {:error, ErrorCat.scope_context_missing()}

  @doc false
  def community_actor(query, :public, _actor), do: query

  @doc false
  def community_actor(query, :owner_management, %{id: actor_id}) when is_integer(actor_id) do
    from([gate_community: community] in query, where: community.user_id == ^actor_id)
  end

  def community_actor(query, :moderator_management, %{id: actor_id}) when is_integer(actor_id) do
    from([gate_community: community] in query,
      where:
        exists(
          from(moderator in CommunityModerator,
            where:
              moderator.community_id == parent_as(:gate_community).id and
                moderator.user_id == ^actor_id,
            select: 1
          )
        )
    )
  end

  def community_actor(query, :operations, actor)
      when actor == :operations or actor == %{type: :operations},
      do: query

  def community_actor(_query, _mode, _actor),
    do: {:error, ErrorCat.scope_policy_actor_mismatch()}

  defp apply_community_lifecycle(query, :public) do
    from([gate_community: community, gate_community_lifecycle: lifecycle] in query,
      where:
        lifecycle.state in ^Communities.Lifecycle.readable_states(:public) or
          (is_nil(lifecycle.id) and community.pending == ^@community_normal)
    )
  end

  defp apply_community_lifecycle(query, policy_mode)
       when policy_mode in [:owner_management, :moderator_management, :operations] do
    from([gate_community_lifecycle: lifecycle] in query,
      where: lifecycle.state in ^Communities.Lifecycle.readable_states(policy_mode)
    )
  end

  defp apply_community_lifecycle(_query, _policy_mode),
    do: {:error, ErrorCat.unknown_policy_mode()}

  defp apply_document_policy(query, :public, :public) do
    from(
      [
        gate_community: community,
        gate_community_lifecycle: community_lifecycle,
        gate_article: article,
        gate_article_lifecycle: article_lifecycle
      ] in query,
      where:
        (community_lifecycle.state in ^Communities.Lifecycle.readable_states(:public) or
           (is_nil(community_lifecycle.id) and community.pending == ^@community_normal)) and
          article.stage == ^:public and
          article_lifecycle.state in ^@document_public_article_states and
          article.pending != ^@audit_illegal
    )
  end

  defp apply_document_policy(query, policy_mode, :draft)
       when policy_mode in [:owner_management, :moderator_management, :operations] do
    from([gate_article: article, gate_article_lifecycle: article_lifecycle] in query,
      where:
        article.stage == ^:draft and
          article_lifecycle.state in ^@document_draft_article_states and
          article.pending != ^@audit_illegal
    )
    |> apply_community_lifecycle(policy_mode)
  end

  defp apply_document_policy(_query, _policy_mode, _stage),
    do: {:error, ErrorCat.scope_context_missing()}

  @doc "Rejects joins and aliases owned by the Gate Scope query."
  @spec reject_conflicting_scope_joins(Ecto.Query.t(), [module()]) ::
          :ok | {:error, GroupherServer.ErrorCat.Error.t()}
  def reject_conflicting_scope_joins(%Ecto.Query{aliases: aliases, joins: joins}, owned_schemas) do
    alias_conflict? = Enum.any?(@reserved_aliases, &Map.has_key?(aliases, &1))

    schema_conflict? =
      Enum.any?(joins, fn
        %Ecto.Query.JoinExpr{source: {_source, schema}} ->
          schema in owned_schemas

        %Ecto.Query.JoinExpr{assoc: {_binding, association}} ->
          association in [:community, :lifecycle]

        _join ->
          false
      end)

    if alias_conflict? or schema_conflict? do
      {:error, ErrorCat.scope_binding_conflict()}
    else
      :ok
    end
  end
end
