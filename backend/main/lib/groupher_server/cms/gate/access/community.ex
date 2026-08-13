defmodule GroupherServer.CMS.Gate.Access.Community do
  @moduledoc """
  Community access composition across Lifecycle, relations and Passport.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Community
        -> allow / deny
        -> domain context
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Const
  alias GroupherServer.CMS.Communities.Lifecycle
  alias GroupherServer.CMS.Gate.Passport.Registry
  alias GroupherServer.CMS.Model.Community

  require Const

  @actions Const.gate_action_values()

  @spec can(User.t() | nil, atom(), Community.t()) ::
          {:ok, boolean()} | {:error, atom()}
  def can(user, action, %Community{} = community) when action in @actions do
    case action do
      :read ->
        with {:ok, true} <- lifecycle_allowed(community, :read) do
          {:ok, true}
        else
          {:ok, false} -> {:ok, read_private_allowed?(user, community)}
          {:error, reason} -> {:error, reason}
        end

      action when action in [:archive, :restore, :schedule_reclaim, :cancel_reclaim, :destroy] ->
        with {:ok, true} <- lifecycle_allowed(community, :command) do
          {:ok, command_relation_allowed?(user, community, action)}
        end
    end
  end

  def can(_user, _action, _community), do: {:error, :unknown_action}

  @spec check(User.t() | nil, atom(), Community.t()) ::
          {:ok, true} | {:error, atom()}
  def check(user, action, community) do
    case can(user, action, community) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lifecycle_allowed(%Community{} = community, :read) do
    case Lifecycle.can_read(community) do
      {:error, :lifecycle_not_loaded} -> {:ok, community.pending == 0}
      result -> result
    end
  end

  defp lifecycle_allowed(%Community{} = community, :command) do
    case Lifecycle.can_manage(community) do
      {:error, :lifecycle_not_loaded} -> {:ok, community.pending == 0}
      result -> result
    end
  end

  defp read_private_allowed?(nil, _community), do: false

  defp read_private_allowed?(%User{} = user, community),
    do: owner?(user, community) or moderator?(user, community) or god?(user)

  defp command_relation_allowed?(nil, _community, _action), do: false

  defp command_relation_allowed?(user, community, :archive) do
    base_command_relation_allowed?(user, community) or
      passport_allowed?(user, community, Const.passport_action(:community_delete))
  end

  defp command_relation_allowed?(user, community, _action),
    do:
      base_command_relation_allowed?(user, community) or
        passport_allowed?(user, community, Const.passport_action(:community_update))

  defp base_command_relation_allowed?(%User{} = user, community),
    do:
      owner?(user, community) or moderator?(user, community) or god?(user) or
        root?(user, community)

  defp base_command_relation_allowed?(_user, _community), do: false

  defp owner?(%User{id: user_id}, %Community{user_id: user_id}), do: true
  defp owner?(_, _), do: false

  defp moderator?(%User{id: user_id}, %Community{moderators: moderators})
       when is_list(moderators) do
    Enum.any?(moderators, &(&1.user_id == user_id))
  end

  defp moderator?(%User{id: user_id}, %Community{meta: %{moderators_ids: ids}})
       when is_list(ids),
       do: user_id in ids

  defp moderator?(_, _), do: false

  defp root?(%User{} = user, %Community{slug: slug}), do: passport_root?(user, slug)
  defp root?(_, _), do: false

  defp god?(%User{} = user) do
    passport =
      Map.get(user, :cur_passport) ||
        Map.get(user, :cms_passport, %{}) |> Map.get(:rules, %{})

    get_in(Registry.normalize_rules(passport), ["global", "god"]) == true
  rescue
    _ -> false
  end

  defp passport_root?(%User{} = user, slug) when is_binary(slug) do
    passport =
      Map.get(user, :cur_passport) ||
        Map.get(user, :cms_passport, %{}) |> Map.get(:rules, %{})

    get_in(Registry.normalize_rules(passport), [slug, "root"]) == true
  rescue
    _ -> false
  end

  defp passport_allowed?(%User{} = user, %Community{slug: slug}, action)
       when is_binary(slug) do
    passport =
      Map.get(user, :cur_passport) ||
        Map.get(user, :cms_passport, %{}) |> Map.get(:rules, %{})

    match?({:ok, true}, Registry.allowed?(passport, slug, action))
  rescue
    _ -> false
  end
end
