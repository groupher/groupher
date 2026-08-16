defmodule GroupherServer.CMS.Gate.Access.Community do
  @moduledoc """
  Community access composition across Lifecycle, relations and Passport.

  Read/list checks use the same explicit policy modes as the Community Scope.
  The default mode is public, so owner identity alone never bypasses the
  Community Lifecycle.

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

  @spec evaluate(User.t() | nil, atom(), Community.t()) ::
          {:ok, boolean()} | {:error, atom()}
  def evaluate(user, action, community), do: evaluate(user, action, community, %{})

  @spec evaluate(User.t() | nil, atom(), Community.t(), map()) ::
          {:ok, boolean()} | {:error, atom()}
  def evaluate(user, action, %Community{} = community, context)
      when action in @actions and is_map(context) do
    case action do
      action when action in [:read, :list] ->
        read_allowed?(user, community, context)

      action
      when action in [
             :update,
             :request_destroy,
             :restore,
             :schedule_destroy,
             :cancel_destroy,
             :destroy
           ] ->
        with {:ok, true} <- lifecycle_allowed(community, :command, context) do
          {:ok, command_relation_allowed?(user, community, action)}
        end

      :manage_docs ->
        case Lifecycle.can_write(community, context) do
          {:ok, true} -> {:ok, management_relation_allowed?(user, community)}
          {:ok, false} -> {:error, :ancestor_community_not_writable}
          {:error, reason} -> {:error, reason}
        end

      :read_draft ->
        {:error, :unknown_action}
    end
  end

  def evaluate(_user, _action, _community, _context), do: {:error, :unknown_action}

  @spec evaluate_result(User.t() | nil, atom(), Community.t()) ::
          {:ok, true} | {:error, atom()}
  def evaluate_result(user, action, community), do: evaluate_result(user, action, community, %{})

  @spec evaluate_result(User.t() | nil, atom(), Community.t(), map()) ::
          {:ok, true} | {:error, atom()}
  def evaluate_result(user, action, community, context) do
    case evaluate(user, action, community, context) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, reason} -> {:error, reason}
    end
  end

  defp read_allowed?(user, %Community{} = community, context) do
    mode = Map.get(context, :policy_mode, :public)

    with :ok <- validate_read_actor(user, mode),
         {:ok, true} <- lifecycle_read_allowed(community, mode, context) do
      {:ok, read_relation_allowed?(user, community, mode)}
    else
      {:ok, false} -> {:ok, false}
      {:error, :lifecycle_not_loaded} -> {:ok, community.pending == 0 and mode == :public}
      {:error, reason} -> {:error, reason}
    end
  end

  defp lifecycle_read_allowed(%Community{} = community, :public, context),
    do: Lifecycle.can_read(community, context)

  defp lifecycle_read_allowed(%Community{} = community, mode, context)
       when mode in [:owner_management, :moderator_management, :operations],
       do: Lifecycle.can_read_mode(community, mode, context)

  defp lifecycle_read_allowed(_community, _mode, _context),
    do: {:error, :unknown_policy_mode}

  defp read_relation_allowed?(_user, _community, :public), do: true

  defp read_relation_allowed?(%User{} = user, community, :owner_management),
    do: owner?(user, community)

  defp read_relation_allowed?(%User{} = user, community, :moderator_management),
    do: moderator?(user, community)

  defp read_relation_allowed?(:operations, _community, :operations), do: true
  defp read_relation_allowed?(%{type: :operations}, _community, :operations), do: true
  defp read_relation_allowed?(_user, _community, _mode), do: false

  defp validate_read_actor(_user, :public), do: :ok

  defp validate_read_actor(%User{}, mode) when mode in [:owner_management, :moderator_management],
    do: :ok

  defp validate_read_actor(:operations, :operations), do: :ok
  defp validate_read_actor(%{type: :operations}, :operations), do: :ok
  defp validate_read_actor(_user, _mode), do: {:error, :permission_denied}

  defp lifecycle_allowed(%Community{} = community, :command, context) do
    case Lifecycle.can_manage(community, context) do
      {:error, :lifecycle_not_loaded} -> {:ok, community.pending == 0}
      result -> result
    end
  end

  defp command_relation_allowed?(nil, _community, _action), do: false
  defp command_relation_allowed?(:operations, _community, _action), do: true
  defp command_relation_allowed?(%{type: :operations}, _community, _action), do: true

  defp command_relation_allowed?(user, community, :request_destroy) do
    base_command_relation_allowed?(user, community) or
      passport_allowed?(user, community, Const.passport_action(:community_request_destroy))
  end

  defp command_relation_allowed?(user, community, _action),
    do:
      base_command_relation_allowed?(user, community) or
        passport_allowed?(user, community, Const.passport_action(:community_update))

  defp management_relation_allowed?(:operations, _community), do: true
  defp management_relation_allowed?(%{type: :operations}, _community), do: true

  defp management_relation_allowed?(%User{} = user, community),
    do:
      owner?(user, community) or moderator?(user, community) or god?(user) or
        root?(user, community) or docs_member?(user, community)

  defp management_relation_allowed?(_user, _community), do: false

  # Docs editing remains an authenticated-member capability; the explicit Gate
  # action still enforces the Community Lifecycle writable state.
  defp docs_member?(%User{}, %Community{}), do: true
  defp docs_member?(_, _), do: false

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
