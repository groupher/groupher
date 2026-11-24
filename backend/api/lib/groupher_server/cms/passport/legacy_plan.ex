defmodule GroupherServer.CMS.Passport.LegacyPlan do
  @moduledoc """
  Produces a report-only plan for legacy Passport facts without granting privileges.

      legacy rules + canonical Community membership -> plan + explicit exceptions

  A plan with any exception is not safe to apply. Thread-limited legacy grants
  cannot be collapsed into unrestricted Community grants.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityAdmin, Passport}
  alias CMS.Passport.Catalog
  alias Helper.PermissionConfig

  # Verified: PermissionConfig and the Community creation middleware both use
  # the Global community.create grant for the same creation operation.
  @verified_same_scope [{:global, "community.create"}]

  @doc "Reads one user's legacy facts and canonical memberships to produce a report without writes."
  def report(user_id) when is_integer(user_id) do
    rules =
      case Repo.get_by(Passport, user_id: user_id) do
        nil -> nil
        %Passport{rules: rules} -> rules
      end

    with {:ok, rules} <- normalize_legacy_rules(rules) do
      memberships =
        Repo.all(
          from(member in CommunityAdmin,
            join: community in Community,
            on: community.id == member.community_id,
            where: member.user_id == ^user_id,
            select: {community.slug, community.id, member.id}
          )
        )
        |> Enum.group_by(fn {slug, _, _} -> slug end)
        |> Map.new(fn
          {slug, [{_, community_id, member_id}]} ->
            {slug, %{community_id: community_id, member_id: member_id}}

          {slug, _duplicates} ->
            {slug, :ambiguous}
        end)

      build(rules, memberships)
    end
  end

  def report(_), do: {:error, :invalid_user}

  @doc false
  def normalize_legacy_rules(nil), do: {:ok, %{"global" => %{}}}

  def normalize_legacy_rules(%{"global" => global, "cms" => cms} = rules)
      when is_map(global) and is_map(cms) do
    if community_rule_shape?(cms) do
      {:ok, rules}
    else
      communities =
        Enum.reduce(cms, %{"global" => global}, fn {slug, grants}, acc ->
          Map.put(acc, slug, %{"cms" => grants})
        end)

      {:ok, communities}
    end
  end

  def normalize_legacy_rules(%{"global" => global} = rules) when is_map(global),
    do: {:ok, rules}

  def normalize_legacy_rules(_), do: {:error, :invalid_legacy_rules}

  defp community_rule_shape?(rules) do
    Enum.any?(Map.keys(rules), fn key -> key == "root" or key in PermissionConfig.contexts() end)
  end

  @doc "Plans one user's legacy rules against a unique slug-to-member map."
  def build(rules, memberships) when is_map(rules) and is_map(memberships) do
    initial = %{is_root: false, global: %{}, communities: %{}, exceptions: []}

    plan =
      rules
      |> Enum.sort_by(fn {key, _} -> to_string(key) end)
      |> Enum.reduce(initial, fn
        {"global", value}, acc -> global(value, acc)
        {slug, value}, acc when is_binary(slug) -> community(slug, value, memberships, acc)
        {key, _}, acc -> exception(acc, :invalid_scope_key, key)
      end)

    {:ok, %{plan | exceptions: Enum.reverse(plan.exceptions)}}
  end

  def build(_, _), do: {:error, :invalid_legacy_rules}

  defp global(value, acc) when is_map(value) do
    Enum.reduce(value, acc, fn
      {"god", root}, state when is_boolean(root) -> %{state | is_root: root}
      {"god", _}, state -> exception(state, :invalid_boolean, "global.god")
      {key, enabled}, state -> grant(key, enabled, :global, state, nil)
    end)
  end

  defp global(_, acc), do: exception(acc, :invalid_global_scope, "global")

  defp community(slug, value, memberships, acc) when is_map(value) do
    case Map.fetch(memberships, slug) do
      {:ok, %{community_id: id, member_id: member_id}}
      when is_integer(id) and is_integer(member_id) ->
        scope = %{community_id: id, member_id: member_id, is_lord: false, permissions: %{}}
        {scope, acc} = community_keys(slug, value, scope, acc)
        %{acc | communities: Map.put(acc.communities, slug, scope)}

      _ ->
        exception(acc, :missing_or_ambiguous_membership, slug)
    end
  end

  defp community(slug, _value, _memberships, acc) do
    exception(acc, :invalid_community_scope, slug)
  end

  defp community_keys(slug, value, scope, acc) do
    Enum.reduce(value, {scope, acc}, fn
      {"root", root}, {scope, acc} when is_boolean(root) ->
        {%{scope | is_lord: root}, acc}

      {"root", _}, {scope, acc} ->
        {scope, exception(acc, :invalid_boolean, "#{slug}.root")}

      {"cms", grants}, {scope, acc} when is_map(grants) ->
        Enum.reduce(grants, {scope, acc}, fn {key, enabled}, {scope, acc} ->
          grant(key, enabled, :community, acc, {slug, scope})
        end)

      {key, _}, {scope, acc} ->
        {scope, exception(acc, :unknown_context, "#{slug}.#{key}")}
    end)
  end

  defp grant(key, enabled, scope, acc, target) when is_binary(key) and is_boolean(enabled) do
    old_grants =
      if scope == :global,
        do: PermissionConfig.global_grants(),
        else: PermissionConfig.cms_grants()

    result =
      cond do
        key == "stamp_passport" ->
          :retired_grant

        key not in old_grants ->
          :unknown_legacy_grant

        true ->
          case Catalog.get(key) do
            {:ok, %{scope: ^scope, grantable: true}} -> :same_scope_action
            {:ok, _} -> :scope_or_grantability_changed
            {:error, _} -> :requires_manual_mapping
          end
      end

    case {result, enabled, target} do
      {:same_scope_action, true, nil} ->
        acc = %{acc | global: Map.put(acc.global, key, true)}

        if {scope, key} in @verified_same_scope do
          acc
        else
          exception(acc, :requires_semantic_review, key)
        end

      {:same_scope_action, false, nil} ->
        acc

      {:same_scope_action, true, {slug, member}} ->
        {%{member | permissions: Map.put(member.permissions, key, true)},
         exception(acc, :requires_semantic_review, "#{slug}.#{key}")}

      {:same_scope_action, false, {_, member}} ->
        {member, acc}

      {reason, _, nil} ->
        exception(acc, reason, key)

      {reason, _, {slug, member}} ->
        {member, exception(acc, reason, "#{slug}.#{key}")}
    end
  end

  defp grant(key, _enabled, _scope, acc, nil), do: exception(acc, :invalid_boolean, key)

  defp grant(key, _enabled, _scope, acc, {slug, member}) do
    {member, exception(acc, :invalid_boolean, "#{slug}.#{key}")}
  end

  defp exception(acc, reason, key) do
    %{acc | exceptions: [%{reason: reason, key: key} | acc.exceptions]}
  end
end
