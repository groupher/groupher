defmodule GroupherServer.CMS.Gate.Scope.Community do
  require GroupherServer.CMS.Communities.Const
  @moduledoc """
  Compiles Community read/list visibility rules into an Ecto query.

  Public reads include active and read-only lifecycle states, with the legacy
  `pending` field used only when a lifecycle row does not yet exist. Restricted
  reads require an explicit owner, moderator, or operations policy mode; an
  actor never upgrades the public mode implicitly.

  Business position:

      Community read/list request
        -> Gate.Scope
        -> Community Scope query
        -> lifecycle-constrained query
        -> community read model

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Community.public()
      iex> %Ecto.Query{} = scope(Ecto.Queryable.to_query(GroupherServer.CMS.Model.Community), nil, :read, context)
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Communities
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Gate.Scope.Policy
  alias GroupherServer.CMS.Model.{CommunityLifecycle, CommunityModerator}

  @behaviour Policy

  @community_normal GroupherServer.CMS.Communities.Const.pending_state(:normal)
  @actions [:read, :list]
  @lifecycle_binding :gate_lifecycle
  @policy_modes Communities.Lifecycle.read_modes()

  @doc "Compiles Community Lifecycle and actor predicates into an Ecto query."
  @spec scope(Ecto.Query.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.Community.t()) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  @impl Policy
  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with {:ok, policy_mode} <- policy_mode(context),
         :ok <- validate_actor(policy_mode, actor) do
      if lifecycle_join?(query) do
        {:error, ErrorCat.scope_binding_conflict()}
      else
        query =
          from(community in query,
            as: :gate_community,
            left_join: lifecycle in CommunityLifecycle,
            as: :gate_lifecycle,
            on: lifecycle.community_id == community.id
          )

        apply_read_policy(query, actor, policy_mode)
      end
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, ErrorCat.unknown_action()}

  # Gate owns this join. Reusing an arbitrary caller join would require guessing
  # whether its join condition has exactly the same policy semantics.
  defp lifecycle_join?(%Ecto.Query{joins: joins, aliases: aliases}) do
    Map.has_key?(aliases, @lifecycle_binding) or
      Enum.any?(joins, fn
        %Ecto.Query.JoinExpr{source: {_source, CommunityLifecycle}} -> true
        %Ecto.Query.JoinExpr{assoc: {_binding, :lifecycle}} -> true
        _join -> false
      end)
  end

  defp apply_read_policy(query, _actor, :public) do
    public_states = Communities.Lifecycle.readable_states(:public)

    from([gate_community: community, gate_lifecycle: lifecycle] in query,
      where:
        lifecycle.state in ^public_states or
          (is_nil(lifecycle.id) and community.pending == ^@community_normal)
    )
  end

  defp apply_read_policy(query, %{id: actor_id}, :owner_management)
       when is_integer(actor_id) do
    management_states = Communities.Lifecycle.readable_states(:owner_management)

    from([gate_community: community, gate_lifecycle: lifecycle] in query,
      where: lifecycle.state in ^management_states and community.user_id == ^actor_id
    )
  end

  defp apply_read_policy(query, %{id: actor_id}, :moderator_management)
       when is_integer(actor_id) do
    management_states = Communities.Lifecycle.readable_states(:moderator_management)

    from([gate_community: community, gate_lifecycle: lifecycle] in query,
      where:
        lifecycle.state in ^management_states and
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

  defp apply_read_policy(query, actor, :operations) do
    if operations_actor?(actor) do
      operations_states = Communities.Lifecycle.readable_states(:operations)

      from([gate_lifecycle: lifecycle] in query, where: lifecycle.state in ^operations_states)
    else
      {:error, ErrorCat.scope_policy_actor_mismatch()}
    end
  end

  defp policy_mode(%{policy_mode: mode}) when mode in @policy_modes, do: {:ok, mode}
  defp policy_mode(%{}), do: {:error, ErrorCat.scope_context_missing()}
  defp policy_mode(_context), do: {:error, ErrorCat.unknown_policy_mode()}

  defp validate_actor(:public, _actor), do: :ok

  defp validate_actor(:operations, actor),
    do:
      if(operations_actor?(actor),
        do: :ok,
        else: {:error, ErrorCat.scope_policy_actor_mismatch()}
      )

  defp validate_actor(mode, %{id: actor_id})
       when mode in [:owner_management, :moderator_management] and is_integer(actor_id), do: :ok

  defp validate_actor(_mode, _actor), do: {:error, ErrorCat.scope_policy_actor_mismatch()}

  defp operations_actor?(:operations), do: true
  defp operations_actor?(%{type: :operations}), do: true
  defp operations_actor?(_actor), do: false
end
