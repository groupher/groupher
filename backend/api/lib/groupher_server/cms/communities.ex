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
    Categories,
    Count,
    Creation,
    Query,
    Members,
    Moderator,
    NamePolicy,
    Setup,
    SlugClaims,
    Subscribe,
    Tags,
    TagStats,
    Writer,
    Commands
  }

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Passport
  alias CMS.Communities.{ErrorCat, Lifecycle}
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
  def create(args, %User{} = user), do: Writer.create(args, user)

  @doc "Runs `update` through the public `Communities` boundary."
  @spec update(Community.t(), map(), User.t() | :operations) :: T.domain_res(Community.t())
  def update(%Community{} = community, args, actor) do
    Writer.update(community, args, actor)
  end

  @doc "Synchronizes base info through the `Communities` boundary."
  @spec sync_base_info(Community.t(), map(), User.t() | :operations) ::
          T.domain_res(Community.t())
  def sync_base_info(%Community{} = community, args, actor) do
    Writer.sync_base_info(community, args, actor)
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
  def retry_setup(application_ref, %User{} = reviewer, expected_version) do
    Setup.retry(application_ref, reviewer, expected_version)
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
  def members(type, %Community{} = community, filters) do
    Members.members(type, community, filters)
  end

  def members(type, community_ref, filters) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Members.members(type, community, filters)
    end
  end

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters, %User{} = user) do
    Members.members(type, community, filters, user)
  end

  def members(type, community_ref, filters, %User{} = user) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Members.members(type, community, filters, user)
    end
  end

  # Category
  @doc "Creates category through the `Communities` write boundary."
  @spec create_category(map(), User.t()) :: T.domain_res(Category.t())
  def create_category(attrs, %User{} = user), do: Categories.create(attrs, user)

  @doc "Returns paged categories through the Communities read boundary."
  @spec paged_categories(map()) :: T.domain_res(T.paged_data())
  def paged_categories(filter), do: Query.page_categories(filter)

  @doc "Updates category through the `Communities` write boundary."
  @spec update_category(String.t(), map()) :: T.domain_res(Category.t())
  def update_category(community, attrs), do: Categories.update(community, attrs)

  @spec update_category(map()) :: T.domain_res(Category.t())
  def update_category(attrs), do: Categories.update(attrs)

  @doc "Removes category through the `Communities` boundary."
  @spec delete_category(String.t(), T.id()) :: T.domain_res(Category.t())
  def delete_category(community, id), do: Categories.delete(community, id)

  @doc "Runs `set_category` through the public `Communities` boundary."
  @spec set_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def set_category(%Community{} = community, %Category{} = category) do
    Categories.set(community, category)
  end

  @spec set_category(Community.t(), T.id()) :: T.domain_res(Community.t())
  def set_category(%Community{} = community, category_id) do
    with {:ok, category} <- ORM.find(Category, category_id) do
      Categories.set(community, category)
    end
  end

  @doc "Runs `unset_category` through the public `Communities` boundary."
  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def unset_category(%Community{} = community, %Category{} = category) do
    Categories.unset(community, category)
  end

  @spec unset_category(Community.t(), T.id()) :: T.domain_res(Community.t())
  def unset_category(%Community{} = community, category_id) do
    with {:ok, category} <- ORM.find(Category, category_id) do
      Categories.unset(community, category)
    end
  end

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
  def add_moderator(%Community{} = community, %User{} = target_user, %User{} = cur_user) do
    Moderator.add(community, target_user, cur_user)
  end

  @doc "Runs `add_moderators` through the public `Communities` boundary."
  @spec add_moderators(Community.t(), list(User.t()), User.t()) :: T.domain_res(Community.t())
  def add_moderators(
        %Community{} = community,
        target_users,
        %User{} = cur_user
      )
      when is_list(target_users) do
    Moderator.add_many(community, target_users, cur_user)
  end

  @doc "Removes moderator through the `Communities` boundary."
  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def remove_moderator(community, %User{} = target_user, %User{} = cur_user) do
    Moderator.remove(community, target_user, cur_user)
  end

  @doc "Updates moderator passport through the `Communities` write boundary."
  @spec update_moderator_passport(String.t() | Community.t(), map(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def update_moderator_passport(community, rules, %User{} = target_user, %User{} = cur_user) do
    Moderator.update_passport(community, rules, target_user, cur_user)
  end

  # Subscribe
  @doc "Runs `subscribe` through the public `Communities` boundary."
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user) do
    Subscribe.subscribe(community, user)
  end

  @doc "Runs `unsubscribe` through the public `Communities` boundary."
  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user) do
    Subscribe.unsubscribe(community, user)
  end

  @doc "Runs `subscribe_ifnot` through the public `Communities` boundary."
  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    Subscribe.subscribe_ifnot(community, user)
  end

  @doc "Runs `subscribe_default_ifnot` through the public `Communities` boundary."
  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user), do: Subscribe.subscribe_default_ifnot(user)

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
  def create_tag(%Community{} = community, thread, attrs, %User{} = user) do
    Tags.create(community, thread, attrs, user)
  end

  def create_tag(community_ref, thread, attrs, %User{} = user) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Tags.create(community, thread, attrs, user)
    end
  end

  @doc "Updates tag through the `Communities` write boundary."
  @spec update_tag(T.id(), map()) :: T.domain_res(CommunityTag.t())
  def update_tag(id, attrs), do: Tags.update(id, attrs)

  @doc "Creates tag group through the `Communities` write boundary."
  @spec create_tag_group(Community.t(), atom(), map()) :: T.domain_res(CommunityTagGroup.t())
  def create_tag_group(%Community{} = community, thread, attrs) do
    Tags.create_group(community, thread, attrs)
  end

  def create_tag_group(community_ref, thread, attrs) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Tags.create_group(community, thread, attrs)
    end
  end

  @doc "Updates tag group through the `Communities` write boundary."
  @spec update_tag_group(Community.t(), atom(), T.id(), map()) ::
          T.domain_res(CommunityTagGroup.t())
  def update_tag_group(%Community{} = community, thread, id, attrs) do
    Tags.update_group(community, thread, id, attrs)
  end

  def update_tag_group(community_ref, thread, id, attrs) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Tags.update_group(community, thread, id, attrs)
    end
  end

  @doc "Removes tag group through the `Communities` boundary."
  @spec delete_tag_group(Community.t(), atom(), T.id()) :: T.domain_res(CommunityTagGroup.t())
  def delete_tag_group(%Community{} = community, thread, id) do
    Tags.delete_group(community, thread, id)
  end

  def delete_tag_group(community_ref, thread, id) do
    with {:ok, community} <- FrontDesk.community(community_ref, mode: :internal) do
      Tags.delete_group(community, thread, id)
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
  def delete_tag(id), do: Tags.delete(id)

  @doc "Runs `set_tag` through the public `Communities` boundary."
  @spec set_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def set_tag(article, id), do: Tags.add(article, id)

  @doc "Runs `unset_tag` through the public `Communities` boundary."
  @spec unset_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def unset_tag(article, id), do: Tags.remove(article, id)

  @doc "Runs `set_tags` through the public `Communities` boundary."
  @spec set_tags(Community.t(), atom(), Ecto.Schema.t(), map()) :: T.domain_res(Ecto.Schema.t())
  def set_tags(%Community{} = community, thread, article, attrs) do
    Tags.set(community, thread, article, attrs)
  end

  @doc "Runs `overwrite_tags` through the public `Communities` boundary."
  @spec overwrite_tags(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          T.domain_res(Ecto.Schema.t())
  def overwrite_tags(%Community{} = community, thread, article, attrs) do
    Tags.overwrite(community, thread, article, attrs)
  end

  @doc "Runs `tag_groups` through the public `Communities` boundary."
  @spec tag_groups(map()) :: T.domain_res(list(CommunityTagGroup.t()))
  def tag_groups(filter), do: Tags.groups(filter)

  @doc "Runs `reindex_tags` through the public `Communities` boundary."
  @spec reindex_tags(Community.t() | String.t(), atom(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(community, thread, group, tags) do
    Tags.reindex_in_group(community, thread, group, tags)
  end

  @spec reindex_tags(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(community, thread, tags) do
    Tags.reindex(community, thread, tags)
  end

  @doc "Runs `reindex_tag_groups` through the public `Communities` boundary."
  @spec reindex_tag_groups(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  def reindex_tag_groups(community, thread, groups) do
    Tags.reindex_groups(community, thread, groups)
  end

  @doc "Runs `tag_stats` through the public `Communities` boundary."
  @spec tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  def tag_stats(tag), do: TagStats.get(tag)

  @spec tag_stats(String.t(), atom(), String.t()) :: T.domain_res(term())
  def tag_stats(community, thread, slug), do: TagStats.get(community, thread, slug)

  @doc "Runs `rebuild_tag_stats` through the public `Communities` boundary."
  @spec rebuild_tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  def rebuild_tag_stats(tag), do: TagStats.rebuild(tag)

  @doc "Runs `rebuild_tag_stats_for_community` through the public `Communities` boundary."
  @spec rebuild_tag_stats_for_community(Community.t() | String.t(), atom()) :: T.domain_res(:pass)
  def rebuild_tag_stats_for_community(community, thread \\ :post) do
    TagStats.rebuild_for_community(community, thread)
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
