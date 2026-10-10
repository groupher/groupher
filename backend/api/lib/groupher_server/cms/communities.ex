defmodule GroupherServer.CMS.Communities do
  @moduledoc """
  Public CMS boundary for community lifecycle, membership, tags, and discovery reads.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Communities.Query / Writer / Commands / Lifecycle
        -> Repo / external boundary
  """

  require GroupherServer.CMS.Communities.ErrorCat

  alias __MODULE__.{
    Count,
    Creation,
    Query,
    NamePolicy,
    Setup,
    SlugClaims,
    Commands
  }

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Passport
  alias CMS.Communities.{ErrorCat, Lifecycle}
  alias CMS.Communities.Categories.Commands.Create, as: CreateCategoryCommand
  alias CMS.Communities.Categories.Commands.Delete, as: DeleteCategoryCommand
  alias CMS.Communities.Categories.Commands.Set, as: SetCategoryCommand
  alias CMS.Communities.Categories.Commands.Unset, as: UnsetCategoryCommand
  alias CMS.Communities.Categories.Commands.Update, as: UpdateCategoryCommand
  alias CMS.Communities.Subscriptions.Commands.Subscribe, as: SubscribeCommand
  alias CMS.Communities.Subscriptions.Commands.Unsubscribe, as: UnsubscribeCommand
  alias CMS.Communities.Subscriptions.Setup, as: SubscriptionsSetup
  alias CMS.Communities.Moderators.Commands.Add, as: AddModeratorCommand
  alias CMS.Communities.Moderators.Commands.AddMany, as: AddManyModeratorsCommand
  alias CMS.Communities.Moderators.Commands.Remove, as: RemoveModeratorCommand
  alias CMS.Communities.Moderators.Commands.UpdatePassport, as: UpdateModeratorPassportCommand
  alias CMS.Communities.Moderators.Query, as: ModeratorsQuery
  alias CMS.Communities.Subscribers.Query, as: SubscribersQuery
  alias CMS.Communities.Tags.Query, as: Tags
  alias CMS.Communities.Tags.Stats, as: Stats
  alias CMS.Communities.Commands.Create, as: CreateCommand
  alias CMS.Communities.Commands.Update, as: UpdateCommand

  alias CMS.Communities.Tags.Commands.{
    CreateTag,
    CreateTagGroup,
    DeleteTag,
    DeleteTagGroup,
    UpdateTag,
    UpdateTagGroup
  }

  alias CMS.FrontDesk
  alias CMS.Model.{Category, Community, CommunityTag, CommunityTagGroup}
  alias Helper.{ORM, T}

  @default_fetch_opts [inc_views: true]

  # Read
  @doc "Fetches a Community through the Gate-scoped read boundary."
  @spec fetch(String.t()) :: T.domain_res(Community.t())
  def fetch(slug), do: fetch(slug, @default_fetch_opts)

  @spec fetch(String.t(), keyword() | User.t()) :: T.domain_res(Community.t())
  def fetch(slug, opt) when is_list(opt), do: fetch_for_viewer(slug, nil, opt)
  def fetch(slug, %User{} = user), do: fetch_for_viewer(slug, user, @default_fetch_opts)

  @spec fetch(String.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def fetch(slug, %User{} = user, opt), do: fetch_for_viewer(slug, user, opt)

  defp fetch_for_viewer(slug, actor, opts) do
    with {:ok, mode} <- read_mode(opts),
         {:ok, community} <- read_community(slug, actor, mode),
         {:ok, community} <- maybe_inc_views(community, opts),
         {:ok, community} <- add_viewer_states(community, actor) do
      {:ok, community}
    else
      {:error, reason} -> {:error, normalize_fetch_error(reason)}
    end
  end

  defp read_mode(opts) do
    case Keyword.get(opts, :policy_mode, :public) do
      :public -> {:ok, :public}
      :management -> {:ok, :management}
      :owner_management -> {:ok, :management}
      :moderator_management -> {:ok, :management}
      :operations -> {:ok, :internal}
      _ -> {:error, CMS.Gate.ErrorCat.unknown_policy_mode()}
    end
  end

  defp read_community(slug, _actor, :internal), do: FrontDesk.community(slug, mode: :internal)
  defp read_community(slug, actor, mode), do: FrontDesk.community(slug, actor, mode: mode)

  defp maybe_inc_views(community, opts) do
    case Keyword.get(opts, :inc_views) do
      true -> ORM.inc(community, :views)
      false -> {:ok, community}
      nil -> {:ok, community}
    end
  end

  defp add_viewer_states(community, %User{id: user_id}) do
    meta = community.meta || %{}

    {:ok,
     Map.merge(community, %{
       viewer_has_subscribed: user_id in Map.get(meta, :subscribed_user_ids, []),
       viewer_is_moderator: user_id in Map.get(meta, :moderators_ids, [])
     })}
  end

  defp add_viewer_states(community, _actor), do: {:ok, community}

  defp normalize_fetch_error(%GroupherServer.ErrorCat.Error{
         reason: :custom,
         details: %{reason: :not_exist}
       }) do
    ErrorCat.not_exist("Community")
  end

  defp normalize_fetch_error(reason), do: reason

  @doc "Checks whether a community name is available in the shared namespace."
  @spec check_name(term()) :: T.domain_res(map())
  def check_name(slug), do: check_name(slug, [])

  @spec check_name(term(), keyword()) :: T.domain_res(map())
  def check_name(slug, opts) do
    case NamePolicy.check(slug, opts) do
      {:ok, normalized_slug} ->
        {:ok, %{normalized_slug: normalized_slug, available: true, reason_code: nil}}

      {:error, reason} ->
        {:ok,
         %{
           normalized_slug: NamePolicy.normalize(slug),
           available: false,
           reason_code: reason_code(reason)
         }}
    end
  end

  defp reason_code(ErrorCat.error_pattern(reason: reason)), do: Atom.to_string(reason)
  defp reason_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp reason_code(_reason), do: "unknown"

  # List
  @doc "Runs `paged` through the public `Communities` boundary."
  @spec paged(map()) :: T.domain_res(T.paged_data())
  def paged(filter), do: Query.page(filter)

  @spec paged(map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(filter, %User{} = user), do: Query.page(filter, user)

  # Write
  @doc "Runs `create` through the public `Communities` boundary."
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(_args, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Creates a Community through the explicit command boundary."
  @spec create(map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user, command_id), do: CreateCommand.execute(args, user, command_id)

  @doc "Runs `update` through the public `Communities` boundary."
  @spec update(Community.t(), map(), User.t() | :operations) :: T.domain_res(Community.t())
  def update(_community, _args, _actor), do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Updates Community fields with the caller-provided command identity."
  @spec update(Community.t(), map(), User.t() | :operations, Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def update(%Community{} = community, args, actor, command_id) do
    UpdateCommand.execute(community, args, actor, command_id)
  end

  @doc "Updates Community fields from an explicit maintenance workflow identity."
  @spec update_operations(Community.t(), map(), String.t()) :: T.domain_res(Community.t())
  def update_operations(%Community{} = community, args, workflow_ref)
      when is_binary(workflow_ref) and workflow_ref != "" do
    UpdateCommand.execute(community, args, :operations, {:workflow, workflow_ref})
  end

  @doc "Creates from application through the `Communities` write boundary."
  @spec create_from_application(String.t(), String.t()) :: T.domain_res(term())
  def create_from_application(application_ref, operation_ref) do
    Creation.create_from_application(application_ref, operation_ref)
  end

  @doc "Runs `run_setup` through the public `Communities` boundary."
  @spec run_setup(String.t(), String.t()) :: T.domain_res(term())
  def run_setup(community_ref, operation_ref), do: Setup.run(community_ref, operation_ref)

  @doc "Runs `retry_setup` through the public `Communities` boundary."
  @spec retry_setup(String.t(), User.t(), integer()) :: T.domain_res(term())
  def retry_setup(_application_ref, %User{} = _reviewer, _expected_version),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Runs setup retry through the receipt-backed Application Command."
  @spec retry_setup(String.t(), User.t(), integer(), Ecto.UUID.t()) :: T.domain_res(term())
  def retry_setup(application_ref, %User{} = reviewer, expected_version, command_id) do
    CMS.CommunityApplications.Commands.RetrySetup.execute(
      application_ref,
      reviewer,
      expected_version,
      command_id
    )
  end

  @doc "Runs `mark_setup_failed` through the public `Communities` boundary."
  @spec mark_setup_failed(String.t(), String.t(), term(), integer()) :: T.domain_res(term())
  def mark_setup_failed(application_ref, operation_ref, reason, attempt) do
    Setup.mark_failed(application_ref, operation_ref, reason, attempt)
  end

  # Lifecycle commands
  @doc "Requests reversible Community destruction through the Lifecycle boundary."
  @spec request_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  def request_destroy(community_ref, opts \\ []) do
    Lifecycle.request_destroy(community_ref, opts)
  end

  @doc "Runs an authenticated destroy request behind the command receipt boundary."
  @spec request_destroy(Community.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def request_destroy(%Community{} = community, %User{} = actor, opts) do
    Commands.RequestDestroy.execute(community, actor, opts)
  end

  @doc "Runs `restore` through the public `Communities` boundary."
  @spec restore(String.t() | integer(), keyword()) :: T.domain_res(term())
  def restore(community_ref, opts \\ []), do: Lifecycle.restore(community_ref, opts)

  @doc "Schedules irreversible Community destruction through Lifecycle."
  @spec schedule_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  def schedule_destroy(community_ref, opts \\ []) do
    Lifecycle.schedule_destroy(community_ref, opts)
  end

  @doc "Cancels a pending Community destruction during its grace period."
  @spec cancel_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  def cancel_destroy(community_ref, opts \\ []) do
    Lifecycle.cancel_destroy(community_ref, opts)
  end

  @doc "Runs `destroy` through the public `Communities` boundary."
  @spec destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  def destroy(community_ref, opts \\ []), do: Lifecycle.destroy(community_ref, opts)

  @doc "Runs `release_expired_slug_claims` through the public `Communities` boundary."
  @spec release_expired_slug_claims(DateTime.t()) :: {non_neg_integer(), nil}
  def release_expired_slug_claims(now), do: SlugClaims.release_expired(now)

  # Members
  @doc "Runs `members` through the public `Communities` boundary."
  @spec members(atom(), Community.t(), map()) :: T.domain_res(T.paged_data())
  def members(:moderators, %Community{} = community, filters),
    do: ModeratorsQuery.page(community, filters)

  def members(:subscribers, %Community{} = community, filters),
    do: SubscribersQuery.page(community, filters)

  def members(type, community_ref, filters) when type in [:moderators, :subscribers] do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      members(type, community, filters)
    end
  end

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def members(:subscribers, %Community{} = community, filters, %User{} = user),
    do: SubscribersQuery.page(community, filters, user)

  def members(:subscribers, community_ref, filters, %User{} = user) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      members(:subscribers, community, filters, user)
    end
  end

  # Category
  @doc "Creates category through the receipt-backed Category Command boundary."
  @spec create_category(map(), User.t()) :: T.domain_res(Category.t())
  def create_category(_attrs, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec create_category(map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def create_category(%{community: community} = attrs, %User{} = user, command_id),
    do: CreateCategoryCommand.execute(community, attrs, user, command_id)

  @doc "Returns paged categories through the Communities read boundary."
  @spec paged_categories(map()) :: T.domain_res(T.paged_data())
  def paged_categories(filter), do: Query.page_categories(filter)

  @doc "Updates category through the receipt-backed Category Command boundary."
  @spec update_category(String.t(), map()) :: T.domain_res(Category.t())
  def update_category(_community, _attrs), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec update_category(String.t(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def update_category(community, attrs, %User{} = user, command_id),
    do: UpdateCategoryCommand.execute(community, attrs, user, command_id)

  @doc "Removes category through the receipt-backed Category Command boundary."
  @spec delete_category(String.t(), T.id()) :: T.domain_res(Category.t())
  def delete_category(_community, _id), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec delete_category(String.t(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Category.t())
  def delete_category(community, id, %User{} = user, command_id),
    do: DeleteCategoryCommand.execute(community, id, user, command_id)

  @doc "Runs `set_category` through the receipt-backed Category Command boundary."
  @spec set_category(Community.t(), T.id()) :: T.domain_res(Community.t())
  def set_category(%Community{}, _category_id), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec set_category(Community.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def set_category(%Community{} = community, category_id, %User{} = user, command_id),
    do: SetCategoryCommand.execute(community, category_id, user, command_id)

  @doc "Runs `unset_category` through the receipt-backed Category Command boundary."
  @spec unset_category(Community.t(), T.id()) :: T.domain_res(Community.t())
  def unset_category(%Community{}, _category_id), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec unset_category(Community.t(), T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def unset_category(%Community{} = community, category_id, %User{} = user, command_id),
    do: UnsetCategoryCommand.execute(community, category_id, user, command_id)

  # Passport
  @doc "Returns passport through the `Communities` boundary."
  @spec get_passport(User.t()) :: T.domain_res(map())
  def get_passport(%User{} = user), do: Passport.get_passport(user)

  def get_passport(%{id: user_id}) when is_integer(user_id) do
    Passport.get_passport(%User{id: user_id})
  end

  @doc "Runs `stamp_passport` through the public `Communities` boundary."
  @spec stamp_passport(map(), User.t()) :: T.domain_res(map())
  def stamp_passport(rules, %User{} = user), do: Passport.stamp_passport(rules, user)

  @doc "Runs `erase_passport` through the public `Communities` boundary."
  @spec erase_passport(list(), User.t()) :: T.domain_res(map())
  def erase_passport(rules, %User{} = user), do: Passport.erase_passport(rules, user)

  @doc "Removes passport through the `Communities` boundary."
  @spec delete_passport(User.t()) :: T.domain_res(map())
  def delete_passport(%User{} = user), do: Passport.delete_passport(user)

  @doc "Returns paged passports from the `Communities` read boundary."
  @spec paged_passports(String.t(), String.t()) :: T.domain_res(list())
  def paged_passports(community, key), do: Passport.paged_passports(community, key)

  @doc "Runs `all_passport_rules` through the public `Communities` boundary."
  @spec all_passport_rules() :: T.domain_res(map())
  def all_passport_rules, do: Passport.all_passport_rules()

  # Moderator
  @doc "Runs `add_moderator` through the public `Communities` boundary."
  @spec add_moderator(Community.t(), User.t(), User.t()) :: T.domain_res(Community.t())
  def add_moderator(%Community{}, %User{}, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec add_moderator(Community.t(), User.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def add_moderator(
        %Community{} = community,
        %User{} = target_user,
        %User{} = cur_user,
        command_id
      ) do
    AddModeratorCommand.execute(community, target_user, cur_user, command_id)
  end

  @doc "Runs `add_moderators` through the public `Communities` boundary."
  @spec add_moderators(Community.t(), list(User.t()), User.t()) :: T.domain_res(Community.t())
  def add_moderators(%Community{}, _target_users, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec add_moderators(Community.t(), list(User.t()), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def add_moderators(%Community{} = community, target_users, %User{} = cur_user, command_id)
      when is_list(target_users),
      do: AddManyModeratorsCommand.execute(community, target_users, cur_user, command_id)

  @doc "Removes moderator through the `Communities` boundary."
  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def remove_moderator(community, %User{} = target_user, %User{} = cur_user) do
    _ = {community, target_user, cur_user}
    {:error, CMS.ErrorCat.command_id_required()}
  end

  def remove_moderator(
        %Community{} = community,
        %User{} = target_user,
        %User{} = cur_user,
        command_id
      ),
      do: RemoveModeratorCommand.execute(community, target_user, cur_user, command_id)

  @doc "Updates moderator passport through the `Communities` write boundary."
  @spec update_moderator_passport(String.t() | Community.t(), map(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def update_moderator_passport(community, rules, %User{} = target_user, %User{} = cur_user) do
    _ = {community, rules, target_user, cur_user}
    {:error, CMS.ErrorCat.command_id_required()}
  end

  def update_moderator_passport(
        %Community{} = community,
        rules,
        %User{} = target_user,
        %User{} = cur_user,
        command_id
      ),
      do:
        UpdateModeratorPassportCommand.execute(
          community,
          rules,
          target_user,
          cur_user,
          command_id
        )

  # Subscribe
  @doc "Rejects the legacy user-mutation arity; callers must provide command_id."
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user), do: reject_command_id(community, user)

  @doc "Runs the receipt-backed user subscription Command."
  @spec subscribe(Community.t() | String.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def subscribe(community, %User{} = user, command_id),
    do: SubscribeCommand.execute(community, user, command_id)

  @doc "Rejects the legacy user-mutation arity; callers must provide command_id."
  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user),
    do: reject_command_id(community, user)

  @doc "Runs the receipt-backed user unsubscribe Command."
  @spec unsubscribe(Community.t() | String.t(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Community.t())
  def unsubscribe(community, %User{} = user, command_id),
    do: UnsubscribeCommand.execute(community, user, command_id)

  @doc "Runs `subscribe_ifnot` through the public `Communities` boundary."
  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    SubscriptionsSetup.subscribe_ifnot(community, user)
  end

  @doc "Runs `subscribe_default_ifnot` through the public `Communities` boundary."
  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user),
    do: SubscriptionsSetup.subscribe_default_ifnot(user)

  defp reject_command_id(_community, _user), do: {:error, CMS.ErrorCat.command_id_required()}

  # Count
  @doc "Updates count through the `Communities` write boundary."
  @spec update_count(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, %User{} = user, type, opt) do
    Count.update(community, user, type, opt)
  end

  @spec update_count(Community.t(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, type), do: Count.update(community, type)

  @spec update_count([Community.t()], atom()) :: T.domain_res(atom())
  def update_count(communities, type) when is_list(communities) do
    Count.update(communities, type)
  end

  @doc "Runs `count` through the public `Communities` boundary."
  @spec count(Community.t(), atom()) :: T.domain_res(integer())
  def count(%Community{} = community, type), do: Count.count(community, type)

  # Tags
  @doc "Creates tag through the `Communities` write boundary."
  @spec create_tag(Community.t(), atom(), map(), User.t()) ::
          T.domain_res(CommunityTag.t())
  def create_tag(%Community{}, _thread, _attrs, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def create_tag(_community_ref, _thread, _attrs, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def create_tag(%Community{} = community, thread, attrs, %User{} = user, command_id) do
    CreateTag.execute(community, thread, attrs, user, command_id)
  end

  def create_tag(community_ref, thread, attrs, %User{} = user, command_id) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      CreateTag.execute(community, thread, attrs, user, command_id)
    end
  end

  @doc "Updates tag through the `Communities` write boundary."
  @spec update_tag(T.id(), map()) :: T.domain_res(CommunityTag.t())
  def update_tag(_id, _attrs), do: {:error, CMS.ErrorCat.command_id_required()}

  def update_tag(_id, _attrs, _command_id), do: {:error, :command_actor_required}

  def update_tag(id, attrs, %User{} = user, command_id),
    do: UpdateTag.execute(id, attrs, user, command_id)

  @doc "Creates tag group through the `Communities` write boundary."
  @spec create_tag_group(Community.t(), atom(), map()) :: T.domain_res(CommunityTagGroup.t())
  def create_tag_group(%Community{}, _thread, _attrs),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def create_tag_group(_community_ref, _thread, _attrs),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def create_tag_group(%Community{}, _thread, _attrs, _command_id),
    do: {:error, :command_actor_required}

  def create_tag_group(community_ref, _thread, _attrs, _command_id) when is_binary(community_ref),
    do: {:error, :command_actor_required}

  def create_tag_group(%Community{} = community, thread, attrs, %User{} = user, command_id) do
    CreateTagGroup.execute(community, thread, attrs, user, command_id)
  end

  def create_tag_group(community_ref, thread, attrs, %User{} = user, command_id) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      CreateTagGroup.execute(community, thread, attrs, user, command_id)
    end
  end

  @doc "Updates tag group through the `Communities` write boundary."
  @spec update_tag_group(Community.t(), atom(), T.id(), map()) ::
          T.domain_res(CommunityTagGroup.t())
  def update_tag_group(%Community{}, _thread, _id, _attrs),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def update_tag_group(_community_ref, _thread, _id, _attrs),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def update_tag_group(%Community{}, _thread, _id, _attrs, _command_id),
    do: {:error, :command_actor_required}

  def update_tag_group(community_ref, _thread, _id, _attrs, _command_id)
      when is_binary(community_ref),
      do: {:error, :command_actor_required}

  def update_tag_group(%Community{} = community, thread, id, attrs, %User{} = user, command_id) do
    UpdateTagGroup.execute(community, thread, id, attrs, user, command_id)
  end

  def update_tag_group(community_ref, thread, id, attrs, %User{} = user, command_id) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      UpdateTagGroup.execute(community, thread, id, attrs, user, command_id)
    end
  end

  @doc "Removes tag group through the `Communities` boundary."
  @spec delete_tag_group(Community.t(), atom(), T.id()) :: T.domain_res(CommunityTagGroup.t())
  def delete_tag_group(%Community{}, _thread, _id),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def delete_tag_group(_community_ref, _thread, _id),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def delete_tag_group(%Community{}, _thread, _id, _command_id),
    do: {:error, :command_actor_required}

  def delete_tag_group(community_ref, _thread, _id, _command_id) when is_binary(community_ref),
    do: {:error, :command_actor_required}

  def delete_tag_group(%Community{} = community, thread, id, %User{} = user, command_id) do
    DeleteTagGroup.execute(community, thread, id, user, command_id)
  end

  def delete_tag_group(community_ref, thread, id, %User{} = user, command_id) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      DeleteTagGroup.execute(community, thread, id, user, command_id)
    end
  end

  @doc "Returns a tag group's title through the Communities read boundary."
  @spec tag_group_title(T.id()) :: {:ok, String.t() | nil}
  def tag_group_title(group_id) do
    case FrontDesk.community_tag_group(group_id) do
      {:ok, group} -> {:ok, group.title}
      {:error, _reason} -> {:ok, nil}
    end
  end

  @doc "Returns tag-group titles keyed by id for GraphQL batch resolution."
  @spec tag_group_titles([T.id()]) :: map()
  def tag_group_titles(group_ids), do: Tags.group_titles(group_ids)

  @spec tag_group_titles(keyword(), [T.id()]) :: map()
  def tag_group_titles(_batch_opts, group_ids), do: Tags.group_titles(group_ids)

  @doc "Removes tag through the `Communities` boundary."
  @spec delete_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def delete_tag(_id), do: {:error, CMS.ErrorCat.command_id_required()}

  def delete_tag(_id, _command_id), do: {:error, :command_actor_required}

  def delete_tag(id, %User{} = user, command_id), do: DeleteTag.execute(id, user, command_id)

  @doc "Runs `set_tag` through the public `Communities` boundary."
  @spec set_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def set_tag(_article, _id), do: {:error, CMS.ErrorCat.command_id_required()}

  def set_tag(_article, _id, _command_id), do: {:error, :command_actor_required}

  def set_tag(article, id, %User{} = user, command_id),
    do: CMS.Communities.Tags.Commands.SetTag.execute(article, id, user, command_id)

  @doc "Runs `unset_tag` through the public `Communities` boundary."
  @spec unset_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def unset_tag(_article, _id), do: {:error, CMS.ErrorCat.command_id_required()}

  def unset_tag(_article, _id, _command_id), do: {:error, :command_actor_required}

  def unset_tag(article, id, %User{} = user, command_id),
    do: CMS.Communities.Tags.Commands.UnsetTag.execute(article, id, user, command_id)

  @doc "Runs `tag_groups` through the public `Communities` boundary."
  @spec tag_groups(map()) :: T.domain_res(list(CommunityTagGroup.t()))
  def tag_groups(filter), do: Tags.groups(filter)

  @doc "Runs `reindex_tags` through the public `Communities` boundary."
  @spec reindex_tags(Community.t() | String.t(), atom(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(_community, _thread, _group, _tags),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Rejects command-id-only tag reindex calls without a Gate actor."
  def reindex_tags_in_group(_community, _thread, _group, _tags, _command_id),
    do: {:error, :command_actor_required}

  def reindex_tags_in_group(community, thread, group, tags, %User{} = user, command_id),
    do:
      CMS.Communities.Tags.Commands.ReindexTagsInGroup.execute(
        community,
        thread,
        group,
        tags,
        user,
        command_id
      )

  @spec reindex_tags(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(_community, _thread, _tags),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @doc "Rejects command-id-only cross-group reindex calls without a Gate actor."
  def reindex_tags_across_groups(_community, _thread, _tags, _command_id),
    do: {:error, :command_actor_required}

  def reindex_tags_across_groups(community, thread, tags, %User{} = user, command_id),
    do:
      CMS.Communities.Tags.Commands.ReindexTagsAcrossGroups.execute(
        community,
        thread,
        tags,
        user,
        command_id
      )

  @doc "Runs `reindex_tag_groups` through the public `Communities` boundary."
  @spec reindex_tag_groups(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  def reindex_tag_groups(_community, _thread, _groups),
    do: {:error, CMS.ErrorCat.command_id_required()}

  def reindex_tag_groups(_community, _thread, _groups, _command_id),
    do: {:error, :command_actor_required}

  def reindex_tag_groups(community, thread, groups, %User{} = user, command_id),
    do:
      CMS.Communities.Tags.Commands.ReindexTagGroups.execute(
        community,
        thread,
        groups,
        user,
        command_id
      )

  @doc "Runs `tag_stats` through the public `Communities` boundary."
  @spec tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  def tag_stats(tag), do: Stats.get(tag)

  @spec tag_stats(String.t(), atom(), String.t()) :: T.domain_res(term())
  def tag_stats(community, thread, slug), do: Stats.get(community, thread, slug)

  @doc "Runs `rebuild_tag_stats` through the public `Communities` boundary."
  @spec rebuild_tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  def rebuild_tag_stats(tag), do: Stats.rebuild(tag)

  @doc "Runs `rebuild_tag_stats_for_community` through the public `Communities` boundary."
  @spec rebuild_tag_stats_for_community(Community.t() | String.t(), atom()) :: T.domain_res(:pass)
  def rebuild_tag_stats_for_community(community, thread \\ :post) do
    Stats.rebuild_for_community(community, thread)
  end

  # Count helpers (migrated from CommunityCRUD)
  @doc "Updates count field through the `Communities` write boundary."
  @spec update_count_field(Community.t() | [Community.t()], atom()) ::
          T.domain_res(Community.t() | :pass)
  def update_count_field(%Community{} = community, field) do
    Count.update(community, field)
  end

  def update_count_field(communities, thread) when is_list(communities) do
    Count.update(communities, thread)
  end

  @doc "Updates inner id through the `Communities` write boundary."
  @spec update_inner_id(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update_inner_id(%Community{} = community, thread, attrs) do
    Count.update_inner_id(community, thread, attrs)
  end
end
