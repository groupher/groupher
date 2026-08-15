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
  alias GroupherServer.CMS.Model.{ArticleLifecycle, Author}
  alias Helper.Constant

  require CMS.Const

  @public_lifecycle_states [:published, :archived]
  @draft_lifecycle_states [:draft_only, :published, :archived]
  @audit_illegal Constant.CMS.pending(:illegal)

  @actions [:read, :list]

  @spec scope(Ecto.Query.t(), term(), atom(), map()) :: Ecto.Query.t() | {:error, atom()}
  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with {:ok, thread} <- resolve_thread(query, context),
         {:ok, policy_mode} <- policy_mode(context),
         {:ok, stage} <- stage(context),
         %Ecto.Query{} = query <- base_scope(query, thread, policy_mode),
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

    with {:ok, expected_schema} <- ArticleSchema.fetch(thread),
         true <- root_schema(query) == expected_schema,
         %Ecto.Query{} = query <- base_scope(query, thread, :public) do
      where(query, [article, ...], article.pending == ^@audit_illegal)
    else
      false -> {:error, :scope_root_mismatch}
      {:error, _reason} = error -> error
    end
  end

  defp base_scope(query, thread, policy_mode) do
    with %Ecto.Query{} = query <- AncestorCommunity.article(query, policy_mode) do
      query
      |> lifecycle_scope(thread)
    end
  end

  defp policy_mode(%{policy_mode: mode})
       when mode in [:public, :owner_management, :moderator_management, :operations],
       do: {:ok, mode}

  defp policy_mode(%{}), do: {:ok, :public}
  defp policy_mode(_), do: {:error, :scope_context_missing}

  defp stage(%{stage: stage}) when stage in [:public, :draft], do: {:ok, stage}
  defp stage(%{}), do: {:ok, :public}
  defp stage(_), do: {:error, :scope_context_missing}

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
