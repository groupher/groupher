defmodule GroupherServer.CMS.Gate.Scope.CommunityChain do
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

  require GroupherServer.CMS.Communities.Const

  import Ecto.Query, warn: false

  alias GroupherServer.CMS

  alias CMS.Communities
  alias CMS.Gate.ErrorCat

  alias CMS.Model.{
    ArticleLifecycle,
    ArticleBinding,
    CommentLifecycle,
    Community,
    CommunityLifecycle,
    CommunityModerator,
    Author
  }

  @community_normal CMS.Communities.Const.pending_state(:normal)
  @reserved_aliases [
    :gate_article,
    :gate_article_binding,
    :gate_article_lifecycle,
    :gate_comment_lifecycle,
    :gate_community,
    :gate_community_lifecycle,
    :gate_doc_branch
  ]

  @doc false
  @spec article(Ecto.Query.t()) :: Ecto.Query.t() | {:error, ErrorCat.error()}
  def article(%Ecto.Query{} = query, policy_mode \\ :public) do
    with {:ok, _} <-
           reject_conflicting_scope_joins(query, [ArticleLifecycle, Community, CommunityLifecycle]) do
      query =
        from(article in query,
          join: binding in ArticleBinding,
          as: :gate_article_binding,
          on: binding.article_id == article.id,
          join: community in Community,
          on: community.id == binding.community_id,
          as: :gate_community,
          left_join: lifecycle in CommunityLifecycle,
          as: :gate_community_lifecycle,
          on: lifecycle.community_id == community.id
        )

      apply_community_lifecycle(query, policy_mode)
    end
  end

  @doc false
  @spec direct(Ecto.Query.t()) :: Ecto.Query.t() | {:error, ErrorCat.error()}
  def direct(%Ecto.Query{} = query) do
    with {:ok, _} <-
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
      when actor == :operations or actor == %{type: :operations} do
    query
  end

  def community_actor(_query, _mode, _actor) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  @doc false
  @spec insights_actor(Ecto.Query.t(), term(), [String.t()]) ::
          Ecto.Query.t() | {:error, ErrorCat.error()}
  def insights_actor(query, actor, granted_community_slugs)
      when is_list(granted_community_slugs) and
             (actor == :operations or actor == %{type: :operations}) do
    query
  end

  def insights_actor(query, %{id: actor_id}, granted_community_slugs)
      when is_integer(actor_id) and is_list(granted_community_slugs) do
    author_ids = from(author in Author, where: author.user_id == ^actor_id, select: author.id)

    from([article, gate_community: community] in query,
      where:
        article.author_id in subquery(author_ids) or
          community.user_id == ^actor_id or
          (community.slug in ^granted_community_slugs and
             exists(
               from(moderator in CommunityModerator,
                 where:
                   moderator.community_id == parent_as(:gate_community).id and
                     moderator.user_id == ^actor_id,
                 select: 1
               )
             ))
    )
  end

  def insights_actor(_query, _actor, _granted_community_slugs) do
    {:error, ErrorCat.scope_policy_actor_mismatch()}
  end

  defp apply_community_lifecycle(query, :public) do
    from([gate_community: community, gate_community_lifecycle: lifecycle] in query,
      where:
        lifecycle.state in ^Communities.Lifecycle.readable_states(:public) or
          (is_nil(lifecycle.id) and community.pending == ^@community_normal)
    )
  end

  defp apply_community_lifecycle(query, policy_mode)
       when policy_mode in [
              :owner_management,
              :moderator_management,
              :operations,
              :insights_management
            ] do
    lifecycle_mode =
      if policy_mode == :insights_management, do: :owner_management, else: policy_mode

    from([gate_community_lifecycle: lifecycle] in query,
      where: lifecycle.state in ^Communities.Lifecycle.readable_states(lifecycle_mode)
    )
  end

  defp apply_community_lifecycle(_query, _policy_mode) do
    {:error, ErrorCat.unknown_policy_mode()}
  end

  @doc "Rejects joins and aliases owned by the Gate Scope query."
  @spec reject_conflicting_scope_joins(Ecto.Query.t(), [module()]) ::
          :ok | {:error, ErrorCat.error()}
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
      {:ok, :pass}
    end
  end
end
