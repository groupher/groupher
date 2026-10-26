defmodule GroupherServer.CMS.Gate.Scope.Article do
  @moduledoc """
  Builds complete public Article and Doc visibility into one query.

  Business position:

      Article query
        -> Gate Scope
        -> Lifecycle state + active review facts
        -> public Article or Doc branch boundary

  Ordinary Article visibility is evaluated from Lifecycle and active
  `ArticleReviewBlock` rows. `ArticleBinding` carries the community
  relationship only; `ArticlePublic` identifies the selected public head.
  Doc visibility additionally requires the branch-scoped `DocPublic` head.
  """

  require GroupherServer.CMS.Docs.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Gate.ErrorCat
  alias CMS.Gate.Scope.{ArticleSchema, CommunityChain, Policy, ReviewRead}

  alias CMS.Model.{
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    Author,
    ArticleReviewBlock,
    DocBranch,
    DocReviewBlock,
    DocDraft,
    DocLifecycle,
    DocPublic
  }

  @behaviour Policy

  @public_lifecycle_states [:published, :archived]
  @draft_lifecycle_states [:draft_only, :published, :archived]
  @actions [:read, :read_draft, :list, :read_insights]
  @management_policy_modes [
    :owner_management,
    :moderator_management,
    :operations,
    :insights_management
  ]

  @doc "Compiles Article or Doc visibility predicates into an Ecto query."
  @spec scope(Ecto.Query.t(), term(), atom(), ArticleContext.t() | DocContext.t()) ::
          Ecto.Query.t() | {:error, ErrorCat.error()}
  @impl Policy
  def scope(%Ecto.Query{} = query, actor, action, context)
      when (is_struct(context, ArticleContext) or is_struct(context, DocContext)) and
             action in @actions do
    with {:ok, thread} <- resolve_thread(query, context),
         {:ok, policy_mode} <- policy_mode(context, action),
         {:ok, stage} <- stage(context, action),
         {:ok, branch_id} <- branch_id(context, thread),
         %Ecto.Query{} = query <- base_scope(query, thread, policy_mode, branch_id),
         {:ok, query} <- apply_stage(query, stage, actor, policy_mode, context),
         {:ok, query} <- apply_actor_policy(query, actor, policy_mode, context) do
      query
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, ErrorCat.scope_context_missing()}

  defp base_scope(query, thread, policy_mode, branch_id)

  defp base_scope(query, :doc, policy_mode, branch_id) do
    with %Ecto.Query{} = query <- CommunityChain.article(query, policy_mode) do
      query
      |> doc_branch_scope(branch_id, policy_mode)
      |> doc_lifecycle_scope(branch_id)
    end
  end

  defp base_scope(query, thread, policy_mode, _branch_id) do
    with %Ecto.Query{} = query <- CommunityChain.article(query, policy_mode) do
      lifecycle_scope(query, thread)
    end
  end

  defp doc_branch_scope(query, branch_id, policy_mode) when is_integer(branch_id) do
    query =
      from([article, ...] in query,
        join: branch in DocBranch,
        as: :gate_doc_branch,
        on:
          branch.community_id == as(:gate_community).id and
            branch.id == ^branch_id
      )

    case policy_mode do
      :public ->
        from([article, ...] in query,
          where: as(:gate_doc_branch).type == ^CMS.Docs.Const.doc_branch_type(:main)
        )

      _ ->
        query
    end
  end

  defp doc_branch_scope(query, :main, policy_mode)
       when policy_mode in [:public, :insights_management] do
    from([article, ...] in query,
      join: branch in DocBranch,
      as: :gate_doc_branch,
      on:
        branch.community_id == as(:gate_community).id and
          branch.type == ^CMS.Docs.Const.doc_branch_type(:main)
    )
  end

  defp doc_branch_scope(_query, _branch_id, _policy_mode) do
    {:error, ErrorCat.scope_context_missing()}
  end

  defp policy_mode(%ArticleContext{policy_mode: mode}, :read_draft)
       when mode in @management_policy_modes do
    {:ok, mode}
  end

  defp policy_mode(%DocContext{policy_mode: mode}, :read_draft)
       when mode in @management_policy_modes do
    {:ok, mode}
  end

  defp policy_mode(%ArticleContext{policy_mode: :insights_management}, :read_insights) do
    {:ok, :insights_management}
  end

  defp policy_mode(%DocContext{policy_mode: :insights_management}, :read_insights) do
    {:ok, :insights_management}
  end

  defp policy_mode(%ArticleContext{policy_mode: :insights_management}, _action) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp policy_mode(%DocContext{policy_mode: :insights_management}, _action) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp policy_mode(%ArticleContext{}, :read_insights) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp policy_mode(%DocContext{}, :read_insights) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp policy_mode(%ArticleContext{policy_mode: mode}, _action)
       when mode in [:public | @management_policy_modes] do
    {:ok, mode}
  end

  defp policy_mode(%DocContext{policy_mode: mode}, _action)
       when mode in [:public | @management_policy_modes] do
    {:ok, mode}
  end

  defp policy_mode(_context, _action), do: {:error, ErrorCat.scope_context_missing()}

  defp stage(%ArticleContext{stage: :draft}, :read_draft), do: {:ok, :draft}
  defp stage(%DocContext{stage: :draft}, :read_draft), do: {:ok, :draft}
  defp stage(%ArticleContext{}, :read_draft), do: {:error, ErrorCat.scope_context_missing()}
  defp stage(%DocContext{}, :read_draft), do: {:error, ErrorCat.scope_context_missing()}

  defp stage(%ArticleContext{policy_mode: :insights_management, stage: :public}, :read_insights) do
    {:ok, :public}
  end

  defp stage(%ArticleContext{policy_mode: :insights_management}, :read_insights) do
    {:error, ErrorCat.scope_context_missing()}
  end

  defp stage(%DocContext{policy_mode: :insights_management, stage: :public}, :read_insights) do
    {:ok, :public}
  end

  defp stage(%DocContext{policy_mode: :insights_management}, :read_insights) do
    {:error, ErrorCat.scope_context_missing()}
  end

  defp stage(%ArticleContext{stage: stage}, _action) when stage in [:public, :draft] do
    {:ok, stage}
  end

  defp stage(%DocContext{stage: stage}, _action) when stage in [:public, :draft] do
    {:ok, stage}
  end

  defp stage(_context, _action), do: {:error, ErrorCat.scope_context_missing()}

  defp branch_id(%DocContext{branch_id: branch_id}, :doc) when is_integer(branch_id) do
    {:ok, branch_id}
  end

  defp branch_id(%DocContext{branch_policy: :main}, :doc), do: {:ok, :main}
  defp branch_id(%DocContext{}, :doc), do: {:error, ErrorCat.scope_context_missing()}
  defp branch_id(%ArticleContext{}, _thread), do: {:ok, nil}

  defp apply_stage(query, :public, actor, _policy_mode, context) do
    query = public_binding_scope(query, actor, context)

    query = public_head_scope(query, context, actor)

    query =
      from([article, ...] in query,
        where: as(:gate_article_lifecycle).state in ^@public_lifecycle_states
      )

    {:ok, public_article(query, actor, context)}
  end

  defp apply_stage(_query, :draft, _actor, :public, _context) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp apply_stage(query, :draft, _actor, _policy_mode, context) do
    {:ok,
     query
     |> draft_head_scope(context)
     |> where([_article, ...], as(:gate_article_lifecycle).state in ^@draft_lifecycle_states)}
  end

  defp public_binding_scope(query, actor = %User{id: user_id}, %DocContext{}) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)
    %{platform?: platform_read?} = ReviewRead.grants(actor)

    from([article, ...] in query,
      where:
        not exists(
          from(restriction in DocReviewBlock,
            where:
              restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                restriction.branch_id == parent_as(:gate_doc_branch).id and
                is_nil(restriction.resolved_at),
            select: 1
          )
        ) or article.author_id in subquery(author_ids) or ^platform_read?
    )
  end

  defp public_binding_scope(query, actor = %User{id: user_id}, %ArticleContext{}) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)
    %{platform?: platform_read?, community_slugs: community_slugs} = ReviewRead.grants(actor)

    from([article, ...] in query,
      where:
        article.author_id in subquery(author_ids) or
          ((not exists(
              from(restriction in ArticleReviewBlock,
                where:
                  restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                    is_nil(restriction.community_id) and is_nil(restriction.resolved_at),
                select: 1
              )
            ) or ^platform_read?) and
             (not exists(
                from(restriction in ArticleReviewBlock,
                  where:
                    restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                      restriction.community_id == parent_as(:gate_community).id and
                      is_nil(restriction.resolved_at),
                  select: 1
                )
              ) or ^platform_read? or as(:gate_community).slug in ^community_slugs))
    )
  end

  defp public_binding_scope(query, _actor, %DocContext{}) do
    from([_article, ...] in query,
      where:
        not exists(
          from(restriction in DocReviewBlock,
            where:
              restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                restriction.branch_id == parent_as(:gate_doc_branch).id and
                is_nil(restriction.resolved_at),
            select: 1
          )
        )
    )
  end

  defp public_binding_scope(query, _actor, _context) do
    from([_article, ...] in query,
      where:
        not exists(
          from(restriction in ArticleReviewBlock,
            where:
              restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                is_nil(restriction.resolved_at) and
                (is_nil(restriction.community_id) or
                   restriction.community_id == parent_as(:gate_community).id),
            select: 1
          )
        )
    )
  end

  defp apply_actor_policy(query, :public, :public, _context), do: {:ok, query}
  defp apply_actor_policy(query, _actor, :public, _context), do: {:ok, query}

  defp apply_actor_policy(query, actor, :insights_management, %{
         passport_granted_community_slugs: slugs
       }) do
    case CommunityChain.insights_actor(query, actor, slugs) do
      %Ecto.Query{} = scoped -> {:ok, scoped}
      {:error, reason} -> {:error, reason}
    end
  end

  defp apply_actor_policy(query, actor, policy_mode, _context)
       when policy_mode in [:owner_management, :moderator_management, :operations] do
    case CommunityChain.community_actor(query, policy_mode, actor) do
      %Ecto.Query{} = scoped -> {:ok, scoped}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lifecycle_scope(query, thread) do
    from(article in query,
      join: lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on: lifecycle.article_id == article.id,
      where: article.thread == ^thread
    )
  end

  defp doc_lifecycle_scope(query, branch_id) when is_integer(branch_id) do
    from(article in query,
      join: lifecycle in DocLifecycle,
      as: :gate_article_lifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == ^branch_id,
      where: article.thread == ^:doc
    )
  end

  defp doc_lifecycle_scope(query, :main) do
    from(article in query,
      join: lifecycle in DocLifecycle,
      as: :gate_article_lifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == as(:gate_doc_branch).id,
      where: article.thread == ^:doc
    )
  end

  defp resolve_thread(%Ecto.Query{from: %{source: {_source, schema}}}, %{thread: thread}) do
    with {:ok, expected_schema} <- ArticleSchema.fetch(thread),
         true <- expected_schema == schema do
      {:ok, thread}
    else
      _ -> {:error, ErrorCat.scope_root_mismatch()}
    end
  end

  defp resolve_thread(%Ecto.Query{from: %{source: {_source, schema}}}, %DocContext{}) do
    with {:ok, expected_schema} <- ArticleSchema.fetch(:doc),
         true <- expected_schema == schema do
      {:ok, :doc}
    else
      _ -> {:error, ErrorCat.scope_root_mismatch()}
    end
  end

  defp resolve_thread(%Ecto.Query{from: %{source: {_source, schema}}}, _context) do
    ArticleSchema.thread_for(schema)
  end

  defp public_article(query, actor = %User{id: user_id}, %DocContext{}) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)
    %{platform?: platform_read?} = ReviewRead.grants(actor)

    from(article in query,
      where:
        not exists(
          from(restriction in DocReviewBlock,
            where:
              restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                restriction.branch_id == parent_as(:gate_doc_branch).id and
                is_nil(restriction.resolved_at),
            select: 1
          )
        ) or article.author_id in subquery(author_ids) or ^platform_read?
    )
  end

  defp public_article(query, actor = %User{id: user_id}, %ArticleContext{}) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)
    %{platform?: platform_read?, community_slugs: community_slugs} = ReviewRead.grants(actor)

    from(article in query,
      where:
        article.author_id in subquery(author_ids) or
          ((not exists(
              from(restriction in ArticleReviewBlock,
                where:
                  restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                    is_nil(restriction.community_id) and is_nil(restriction.resolved_at),
                select: 1
              )
            ) or ^platform_read?) and
             (not exists(
                from(restriction in ArticleReviewBlock,
                  where:
                    restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                      restriction.community_id == parent_as(:gate_community).id and
                      is_nil(restriction.resolved_at),
                  select: 1
                )
              ) or as(:gate_community).slug in ^community_slugs))
    )
  end

  defp public_article(query, actor, %DocContext{}) do
    %{platform?: platform_read?} = ReviewRead.grants(actor)

    from(article in query,
      where:
        not exists(
          from(restriction in DocReviewBlock,
            where:
              restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                restriction.branch_id == parent_as(:gate_doc_branch).id and
                is_nil(restriction.resolved_at),
            select: 1
          )
        ) or ^platform_read?
    )
  end

  defp public_article(query, actor, %ArticleContext{}) do
    %{platform?: platform_read?, community_slugs: community_slugs} = ReviewRead.grants(actor)

    from(article in query,
      where:
        (not exists(
           from(restriction in ArticleReviewBlock,
             where:
               restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                 is_nil(restriction.community_id) and is_nil(restriction.resolved_at),
             select: 1
           )
         ) or ^platform_read?) and
          (not exists(
             from(restriction in ArticleReviewBlock,
               where:
                 restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                   restriction.community_id == parent_as(:gate_community).id and
                   is_nil(restriction.resolved_at),
               select: 1
             )
           ) or as(:gate_community).slug in ^community_slugs)
    )
  end

  defp public_head_scope(query, %DocContext{}, %User{id: user_id} = actor) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)
    %{platform?: platform_read?} = ReviewRead.grants(actor)

    query =
      from([article, ...] in query,
        join: public in DocPublic,
        as: :gate_article_public,
        on: public.article_id == article.id and public.branch_id == as(:gate_doc_branch).id
      )

    from([article, ...] in query,
      where:
        as(:gate_article_public).visible == true or
          ((article.author_id in subquery(author_ids) or ^platform_read?) and
             exists(
               from(restriction in DocReviewBlock,
                 where:
                   restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                     restriction.branch_id == parent_as(:gate_doc_branch).id and
                     is_nil(restriction.resolved_at),
                 select: 1
               )
             ))
    )
  end

  defp public_head_scope(query, %DocContext{}, _actor) do
    query =
      from([article, ...] in query,
        join: public in DocPublic,
        as: :gate_article_public,
        on: public.article_id == article.id and public.branch_id == as(:gate_doc_branch).id
      )

    from([article, ...] in query,
      where:
        as(:gate_article_public).visible == true and
          not exists(
            from(restriction in DocReviewBlock,
              where:
                restriction.article_id == parent_as(:gate_article_lifecycle).article_id and
                  restriction.branch_id == parent_as(:gate_doc_branch).id and
                  is_nil(restriction.resolved_at),
              select: 1
            )
          )
    )
  end

  defp public_head_scope(query, %ArticleContext{}, _actor) do
    from(article in query,
      join: public in ArticlePublic,
      as: :gate_article_public,
      on: public.article_id == article.id
    )
  end

  defp draft_head_scope(query, %ArticleContext{}) do
    from(article in query,
      join: draft in ArticleDraft,
      as: :gate_article_draft,
      on: draft.article_id == article.id
    )
  end

  defp draft_head_scope(query, %DocContext{}) do
    from([article, ...] in query,
      join: draft in DocDraft,
      as: :gate_doc_draft,
      on: draft.article_id == article.id and draft.branch_id == as(:gate_doc_branch).id
    )
  end
end
