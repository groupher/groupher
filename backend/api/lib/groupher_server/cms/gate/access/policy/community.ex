defmodule GroupherServer.CMS.Gate.Access.Policy.Community do
  @moduledoc """
  Community access composition across Lifecycle, bindings and Passport.

  Read/list visibility belongs to Community Scope. Access only checks the
  resource mutation and management actions against the loaded facts.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Community
        -> allow / deny
        -> domain context

  Moderator management uses the dedicated `:manage_moderators` action. Root and
  global-god admission stays here; moderator persistence never re-checks actor
  policy.

  Example contract:

      Access.Policy.Community.check_access(actor, :update, community, %Context.Access.Community{})
      #=> {:ok, :pass} | {:error, reason}
  """

  require GroupherServer.CMS.Gate.Const

  require GroupherServer.CMS.Gate.ErrorCat

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Communities.Lifecycle
  alias CMS.Gate.{Const, ErrorCat}
  alias CMS.Gate.Context.Access.Community, as: CommunityContext
  alias CMS.Model.{Community, CommunityLifecycle}
  alias CMS.Passport.Registry

  @read_actions [:read, :list]
  @command_actions [
    :update,
    :category_create,
    :category_update,
    :category_delete,
    :category_set,
    :category_unset,
    :import_docs,
    :request_destroy,
    :restore,
    :schedule_destroy,
    :cancel_destroy,
    :destroy
  ]

  @doc """
  Checks Community admission using the default loaded lifecycle context.

  This is a test seam for policy-only callers and deliberately reads only
  embedded Passport facts from `user`; it does not load the database Passport.
  Production access checks must use `CMS.Gate.Access.Check.community/3`, which
  builds the complete context through `Load.Query.community/2`.

  ## Examples

      CommunityPolicy.check_access(actor, :update, community)
      #=> {:ok, :pass} | {:error, reason}
  """
  @spec check_access(User.t() | nil, atom(), Community.t()) ::
          {:ok, :pass} | {:error, ErrorCat.error()}
  def check_access(user, action, community) do
    check_access(user, action, community, %CommunityContext{
      community: community,
      community_lifecycle: Map.get(community, :lifecycle),
      passport_rules: embedded_passport_rules(user)
    })
  end

  @doc "Allows Community creation only for an authenticated user."
  @spec check_create(User.t() | term()) :: {:ok, :pass} | {:error, ErrorCat.error()}
  def check_create(%User{}), do: {:ok, :pass}
  def check_create(_actor), do: {:error, ErrorCat.permission_denied()}

  @doc "Checks Community admission against an explicitly typed Access Context."
  @spec check_access(User.t() | nil, atom(), Community.t(), CommunityContext.t()) ::
          {:ok, :pass} | {:error, ErrorCat.error()}
  def check_access(_user, action, %Community{} = community, %CommunityContext{} = context)
      when action in @read_actions do
    read_allowed?(community, context)
  end

  def check_access(user, action, %Community{} = community, %CommunityContext{} = context)
      when action in @command_actions do
    with {:ok, true} <- lifecycle_allowed(community, :command, context) do
      relation_allowed(command_binding_allowed?(user, community, action, context))
    end
  end

  def check_access(
        user,
        :manage_moderators,
        %Community{} = community,
        %CommunityContext{} = context
      ) do
    with {:ok, true} <- lifecycle_allowed(community, :command, context) do
      moderator_management_access(user, community, context)
    end
  end

  def check_access(user, :manage_docs, %Community{} = community, %CommunityContext{} = context) do
    case lifecycle_capability(context, :write) do
      {:ok, true} -> relation_allowed(management_binding_allowed?(user, community, context))
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, reason} -> {:error, reason}
    end
  end

  def check_access(
        %User{},
        :create_article,
        %Community{} = community,
        %CommunityContext{} = context
      ) do
    case Lifecycle.can_write(community, context) do
      {:ok, true} -> {:ok, :pass}
      {:ok, false} -> {:error, ErrorCat.ancestor_community_not_writable()}
      {:error, reason} -> {:error, reason}
    end
  end

  def check_access(_user, _action, _community, _context), do: {:error, ErrorCat.unknown_action()}

  defp read_allowed?(%Community{} = community, context) do
    case Lifecycle.can_read(community, context) do
      {:ok, true} ->
        {:ok, :pass}

      {:ok, false} ->
        {:error, ErrorCat.permission_denied()}

      {:error, ErrorCat.error_pattern() = error} ->
        {:error, error}
    end
  end

  defp relation_allowed(true), do: {:ok, :pass}
  defp relation_allowed(false), do: {:error, ErrorCat.permission_denied()}

  defp lifecycle_allowed(%Community{} = community, :command, context) do
    _ = community
    lifecycle_capability(context, :manage)
  end

  defp lifecycle_capability(
         %CommunityContext{community_lifecycle: %CommunityLifecycle{} = lifecycle} = context,
         :manage
       ) do
    Lifecycle.can_manage(lifecycle, context)
  end

  defp lifecycle_capability(
         %CommunityContext{community_lifecycle: %CommunityLifecycle{} = lifecycle} = context,
         :write
       ) do
    Lifecycle.can_write(lifecycle, context)
  end

  defp lifecycle_capability(_context, _capability) do
    {:error, ErrorCat.lifecycle_not_loaded()}
  end

  defp command_binding_allowed?(nil, _community, _action, _context), do: false
  defp command_binding_allowed?(:operations, _community, _action, _context), do: true
  defp command_binding_allowed?(%{type: :operations}, _community, _action, _context), do: true

  defp command_binding_allowed?(user, community, :request_destroy, context) do
    base_command_binding_allowed?(user, community, context) or
      passport_allowed?(community, Const.passport_action(:community_request_destroy), context)
  end

  defp command_binding_allowed?(_user, community, :import_docs, context) do
    passport_allowed?(community, CMS.GateAction.doc_import(), context)
  end

  defp command_binding_allowed?(user, community, action, context)
       when action in [
              :category_create,
              :category_update,
              :category_delete,
              :category_set,
              :category_unset
            ] do
    base_command_binding_allowed?(user, community, context) or
      passport_allowed?(community, category_passport_action(action), context)
  end

  defp command_binding_allowed?(user, community, _action, context) do
    base_command_binding_allowed?(user, community, context) or
      passport_allowed?(community, Const.passport_action(:community_update), context)
  end

  defp category_passport_action(:category_create), do: Const.passport_action(:category_create)
  defp category_passport_action(:category_update), do: Const.passport_action(:category_update)
  defp category_passport_action(:category_delete), do: Const.passport_action(:category_delete)
  defp category_passport_action(:category_set), do: Const.passport_action(:category_set)
  defp category_passport_action(:category_unset), do: Const.passport_action(:category_unset)

  defp management_binding_allowed?(:operations, _community, _context), do: true
  defp management_binding_allowed?(%{type: :operations}, _community, _context), do: true

  defp management_binding_allowed?(%User{} = user, community, context) do
    owner?(user, community) or moderator?(user, community) or god?(context) or
      root?(community, context) or docs_member?(user, community)
  end

  defp management_binding_allowed?(_user, _community, _context), do: false

  # Docs editing remains an authenticated-member capability; the explicit Gate
  # action still enforces the Community Lifecycle writable state.
  defp docs_member?(%User{}, %Community{}), do: true
  defp docs_member?(_, _), do: false

  defp base_command_binding_allowed?(%User{} = user, community, context) do
    owner?(user, community) or moderator?(user, community) or god?(context) or
      root?(community, context)
  end

  defp base_command_binding_allowed?(_user, _community, _context), do: false

  defp moderator_management_access(user, community, context) do
    relation_allowed(moderator_management_binding_allowed?(user, community, context))
  end

  defp moderator_management_binding_allowed?(:operations, _community, _context), do: true
  defp moderator_management_binding_allowed?(%{type: :operations}, _community, _context), do: true

  defp moderator_management_binding_allowed?(%User{}, community, context) do
    god?(context) or root?(community, context)
  end

  defp moderator_management_binding_allowed?(_user, _community, _context), do: false

  defp owner?(%User{id: user_id}, %Community{user_id: user_id}), do: true
  defp owner?(_, _), do: false

  defp moderator?(%User{id: user_id}, %Community{moderators: moderators})
       when is_list(moderators) do
    Enum.any?(moderators, &(&1.user_id == user_id))
  end

  defp moderator?(%User{id: user_id}, %Community{meta: %{moderators_ids: ids}})
       when is_list(ids) do
    user_id in ids
  end

  defp moderator?(_, _), do: false

  defp root?(%Community{slug: slug}, context), do: passport_root?(slug, context)
  defp root?(_, _), do: false

  defp god?(%CommunityContext{passport_rules: passport_rules}) do
    get_in(Registry.normalize_rules(passport_rules), ["global", "god"]) == true
  rescue
    _ -> false
  end

  defp passport_root?(slug, %CommunityContext{passport_rules: passport_rules})
       when is_binary(slug) do
    get_in(Registry.normalize_rules(passport_rules), [slug, "root"]) == true
  rescue
    _ -> false
  end

  defp passport_allowed?(%Community{slug: slug}, action, %CommunityContext{
         passport_rules: passport
       })
       when is_binary(slug) do
    case Registry.allowed?(passport, slug, action) do
      {:ok, true} ->
        true

      _ ->
        passport
        |> Registry.normalize_rules()
        |> get_in([slug, "cms", action])
        |> Kernel.==(true)
    end
  rescue
    _ -> false
  end

  defp embedded_passport_rules(%User{} = user) do
    embedded = Map.get(user, :cur_passport)
    association = Map.get(user, :cms_passport)

    cond do
      is_map(embedded) and map_size(embedded) > 0 ->
        embedded
        |> Map.get(:rules, Map.get(embedded, "rules", embedded))
        |> Registry.normalize_rules()

      match?(%{rules: _rules}, association) ->
        association.rules |> Registry.normalize_rules()

      true ->
        Registry.empty_rules()
    end
  rescue
    _ -> Registry.empty_rules()
  end

  defp embedded_passport_rules(_actor), do: Registry.empty_rules()
end
