defmodule GroupherServer.CMS.Gate.Access.Policy.Community do
  @moduledoc """
  Community access composition across Lifecycle, relations and Passport.

  Read/list visibility belongs to Community Scope. Access only checks the
  resource mutation and management actions against the loaded facts.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Community
        -> allow / deny
        -> domain context

  Example contract:

      Access.Policy.community(actor, :update, community, %Context.Access.Community{})
      #=> :ok | {:error, reason}
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Const
  alias GroupherServer.CMS.Communities.Lifecycle
  alias GroupherServer.CMS.Gate.Context.Access.Community, as: CommunityContext
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Passport.Registry
  alias GroupherServer.CMS.Model.Community

  require Const

  @actions Const.gate_action_values()

  @doc "Checks Community admission using the default loaded lifecycle context."
  @spec check_access(User.t() | nil, atom(), Community.t()) ::
          :ok | {:error, GroupherServer.ErrorCat.Error.t()}
  def check_access(user, action, community),
    do:
      check_access(user, action, community, %CommunityContext{
        community: community,
        community_lifecycle: Map.get(community, :lifecycle)
      })

  @doc "Checks Community admission against an explicitly typed Access Context."
  @spec check_access(User.t() | nil, atom(), Community.t(), CommunityContext.t()) ::
          :ok | {:error, GroupherServer.ErrorCat.Error.t()}
  def check_access(user, action, %Community{} = community, %CommunityContext{} = context)
      when action in @actions do
    case action do
      action when action in [:read, :list] ->
        read_allowed?(community, context)

      action
      when action in [
             :update,
             :request_destroy,
             :restore,
             :schedule_destroy,
             :cancel_destroy,
             :destroy
           ] ->
        with {:ok, true} <- lifecycle_allowed(community, :command, context),
             :ok <- relation_allowed(command_relation_allowed?(user, community, action)) do
          :ok
        end

      :manage_docs ->
        case Lifecycle.can_write(community, context) do
          {:ok, true} -> relation_allowed(management_relation_allowed?(user, community))
          {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
          {:error, reason} -> {:error, reason}
        end

      :read_draft ->
        {:error, ErrorCat.unknown_action()}
    end
  end

  def check_access(_user, _action, _community, _context), do: {:error, ErrorCat.unknown_action()}

  defp read_allowed?(%Community{} = community, context) do
    with {:ok, true} <- Lifecycle.can_read(community, context) do
      :ok
    else
      {:ok, false} ->
        {:error, ErrorCat.permission_denied()}

      {:error, %GroupherServer.ErrorCat.Error{reason: :lifecycle_not_loaded}} ->
        relation_allowed(community.pending == 0)

      {:error, %GroupherServer.ErrorCat.Error{} = error} ->
        {:error, error}
    end
  end

  defp relation_allowed(true), do: :ok
  defp relation_allowed(false), do: {:error, ErrorCat.permission_denied()}

  defp lifecycle_allowed(%Community{} = community, :command, context) do
    case Lifecycle.can_manage(community, context) do
      {:error, %GroupherServer.ErrorCat.Error{reason: :lifecycle_not_loaded}} ->
        {:ok, community.pending == 0}

      result ->
        result
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
