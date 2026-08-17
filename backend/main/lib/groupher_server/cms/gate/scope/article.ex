defmodule GroupherServer.CMS.Gate.Scope.Article do
  @moduledoc """
  Compiles complete public Article visibility into one query.

  Business position:

      Article query
        -> Gate Scope
        -> public Article boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Gate.Scope.{AncestorCommunity, ArticleSchema}
  alias GroupherServer.CMS.Model.{ArticleLifecycle, Author, DocBranch, DocLifecycle}
  alias Helper.Constant

  require CMS.Const

  @public_lifecycle_states [:published, :archived]
  @draft_lifecycle_states [:draft_only, :published, :archived]
  @audit_illegal Constant.CMS.pending(:illegal)

  @actions [:read, :read_draft, :list]
  @management_policy_modes [:owner_management, :moderator_management, :operations]

  @spec scope(Ecto.Query.t(), term(), atom(), map()) :: Ecto.Query.t() | {:error, atom()}
  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with {:ok, thread} <- resolve_thread(query, context),
         {:ok, policy_mode} <- policy_mode(context, action),
         {:ok, stage} <- stage(context, action),
         {:ok, branch_id} <- branch_id(context, thread),
         %Ecto.Query{} = query <- base_scope(query, thread, policy_mode, branch_id),
         {:ok, query} <- apply_stage(query, stage, actor, policy_mode, context),
         {:ok, query} <- apply_actor_policy(query, actor, policy_mode) do
      query
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, :unknown_action}

  @doc false
  @spec moderation_diagnostic_scope(Ecto.Queryable.t(), atom()) ::
          Ecto.Query.t() | {:error, atom()}
  def moderation_diagnostic_scope(queryable, thread) do
    query = Ecto.Queryable.to_query(queryable)
    branch_id = if thread == :doc, do: :main, else: nil

    with {:ok, expected_schema} <- ArticleSchema.fetch(thread),
         true <- root_schema(query) == expected_schema,
         %Ecto.Query{} = query <- base_scope(query, thread, :public, branch_id) do
      where(query, [article, ...], article.pending == ^@audit_illegal)
    else
      false -> {:error, :scope_root_mismatch}
      {:error, _reason} = error -> error
    end
  end

  defp base_scope(query, thread, policy_mode, branch_id)

  defp base_scope(query, :doc, policy_mode, branch_id) do
    with %Ecto.Query{} = query <- AncestorCommunity.article(query, policy_mode) do
      query
      |> doc_lifecycle_scope(branch_id)
      |> doc_branch_scope(branch_id, policy_mode)
    end
  end

  defp base_scope(query, thread, policy_mode, _branch_id) do
    with %Ecto.Query{} = query <- AncestorCommunity.article(query, policy_mode) do
      lifecycle_scope(query, thread)
    end
  end

  defp doc_branch_scope(query, branch_id, policy_mode) when is_integer(branch_id) do
    query =
      from([article, ...] in query,
        join: branch in DocBranch,
        as: :gate_doc_branch,
        on:
          branch.id == article.branch_id and branch.community_id == article.community_id and
            branch.id == ^branch_id
      )

    case policy_mode do
      :public ->
        from([article, ...] in query,
          where: as(:gate_doc_branch).type == ^CMS.Const.doc_branch_type(:main)
        )

      _ ->
        query
    end
  end

  defp doc_branch_scope(query, :main, :public) do
    from([article, ...] in query,
      join: branch in DocBranch,
      as: :gate_doc_branch,
      on:
        branch.id == article.branch_id and branch.community_id == article.community_id and
          branch.type == ^CMS.Const.doc_branch_type(:main)
    )
  end

  defp doc_branch_scope(_query, _branch_id, _policy_mode),
    do: {:error, :scope_context_missing}

  defp policy_mode(%{policy_mode: mode}, :read_draft)
       when mode in @management_policy_modes,
       do: {:ok, mode}

  defp policy_mode(%{}, :read_draft), do: {:ok, :owner_management}

  defp policy_mode(%{policy_mode: mode}, _action)
       when mode in [:public | @management_policy_modes],
       do: {:ok, mode}

  defp policy_mode(%{}, _action), do: {:error, :scope_context_missing}
  defp policy_mode(_, _action), do: {:error, :scope_context_missing}

  defp stage(%{stage: :draft}, :read_draft), do: {:ok, :draft}
  defp stage(%{stage: _stage}, :read_draft), do: {:error, :scope_context_missing}
  defp stage(%{}, :read_draft), do: {:ok, :draft}

  defp stage(%{stage: stage}, _action) when stage in [:public, :draft], do: {:ok, stage}
  defp stage(%{}, _action), do: {:ok, :public}
  defp stage(_, _action), do: {:error, :scope_context_missing}

  defp branch_id(%{branch_id: branch_id}, :doc) when is_integer(branch_id), do: {:ok, branch_id}
  defp branch_id(%{branch_policy: :main}, :doc), do: {:ok, :main}
  defp branch_id(%{}, :doc), do: {:error, :scope_context_missing}
  defp branch_id(_, :doc), do: {:error, :scope_context_missing}
  defp branch_id(_context, _thread), do: {:ok, nil}

  defp apply_stage(query, :public, actor, _policy_mode, context) do
    query = from([article, ...] in query, where: article.stage == ^:public)

    query =
      from([article, ...] in query,
        where: as(:gate_article_lifecycle).state in ^@public_lifecycle_states
      )

    {:ok, public_article(query, actor, context)}
  end

  defp apply_stage(_query, :draft, _actor, :public, _context),
    do: {:error, :scope_policy_actor_mismatch}

  defp apply_stage(query, :draft, _actor, _policy_mode, _context) do
    {:ok,
     from(article in query,
       where:
         article.stage == ^:draft and
           as(:gate_article_lifecycle).state in ^@draft_lifecycle_states
     )}
  end

  defp apply_actor_policy(query, :public, :public), do: {:ok, query}
  defp apply_actor_policy(query, _actor, :public), do: {:ok, query}

  defp apply_actor_policy(query, actor, policy_mode)
       when policy_mode in [:owner_management, :moderator_management, :operations] do
    case AncestorCommunity.community_actor(query, policy_mode, actor) do
      %Ecto.Query{} = scoped -> {:ok, scoped}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lifecycle_scope(query, thread) do
    from(article in query,
      join: lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on:
        lifecycle.community_id == article.community_id and lifecycle.thread == ^thread and
          lifecycle.article_hash_id == article.article_hash_id
    )
  end

  defp doc_lifecycle_scope(query, branch_id) when is_integer(branch_id) do
    from(article in query,
      join: lifecycle in DocLifecycle,
      as: :gate_article_lifecycle,
      on:
        lifecycle.community_id == article.community_id and lifecycle.branch_id == ^branch_id and
          lifecycle.article_hash_id == article.article_hash_id
    )
  end

  defp doc_lifecycle_scope(query, :main) do
    from(article in query,
      join: lifecycle in DocLifecycle,
      as: :gate_article_lifecycle,
      on:
        lifecycle.community_id == article.community_id and
          lifecycle.branch_id == article.branch_id and
          lifecycle.article_hash_id == article.article_hash_id
    )
  end

  defp resolve_thread(%Ecto.Query{from: %{source: {_source, schema}}}, %{thread: thread}) do
    with {:ok, expected_schema} <- ArticleSchema.fetch(thread),
         true <- expected_schema == schema do
      {:ok, thread}
    else
      _ -> {:error, :scope_root_mismatch}
    end
  end

  defp resolve_thread(%Ecto.Query{from: %{source: {_source, schema}}}, _context),
    do: ArticleSchema.thread_for(schema)

  defp root_schema(%Ecto.Query{from: %{source: {_source, schema}}}), do: schema
  defp root_schema(_query), do: nil

  defp public_article(query, _actor, %{include_illegal: true}), do: query

  defp public_article(query, %User{id: user_id}, _context) do
    author_ids = from(author in Author, where: author.user_id == ^user_id, select: author.id)

    from(article in query,
      where:
        article.pending != ^@audit_illegal or
          article.author_id in subquery(author_ids)
    )
  end

  defp public_article(query, _actor, _context) do
    from(article in query,
      where: article.pending != ^@audit_illegal
    )
  end
end
