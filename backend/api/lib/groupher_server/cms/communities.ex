defmodule GroupherServer.CMS.Communities do
  @moduledoc """
  Public CMS boundary for community lifecycle, membership, tags, and discovery reads.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Communities
        -> Repo / external boundary
  """
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Category, Community, CommunityTag, CommunityTagGroup}
  alias Helper.T

  alias __MODULE__.{
    Categories,
    Count,
    Creation,
    List,
    Members,
    Moderator,
    NamePolicy,
    Reader,
    Setup,
    SlugClaims,
    Subscribe,
    Tags,
    TagStats,
    Writer
  }

  alias GroupherServer.CMS.Communities.Lifecycle
  alias GroupherServer.CMS.Passport

  # Read
  @spec fetch(String.t()) :: T.domain_res(Community.t())
  @doc "Fetches a Community through the Gate-scoped read boundary."
  def fetch(slug), do: Reader.fetch(slug)

  @spec fetch(String.t(), keyword() | User.t() | :operations) :: T.domain_res(Community.t())
  def fetch(slug, opt) when is_list(opt), do: Reader.fetch(slug, opt)
  def fetch(slug, %User{} = user), do: Reader.fetch(slug, user)
  def fetch(slug, :operations), do: Reader.fetch(slug, :operations)

  @spec fetch(String.t(), User.t() | :operations, keyword()) :: T.domain_res(Community.t())
  def fetch(slug, %User{} = user, opt), do: Reader.fetch(slug, user, opt)
  def fetch(slug, :operations, opt), do: Reader.fetch(slug, :operations, opt)

  @spec check_name(term()) :: T.domain_res(map())
  @doc "Checks whether a community name is available in the shared namespace."
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

  defp reason_code(%GroupherServer.ErrorCat.Error{reason: reason}), do: Atom.to_string(reason)
  defp reason_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp reason_code(_reason), do: "unknown"

  # List
  @spec paged(map()) :: T.domain_res(T.paged_data())
  @doc "Runs `paged` through the public `Communities` boundary."
  def paged(filter), do: List.page(filter)

  @spec paged(map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(filter, %User{} = user), do: List.page(filter, user)

  # Write
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `create` through the public `Communities` boundary."
  def create(args, %User{} = user), do: Writer.create(args, user)

  @spec update(Community.t(), map(), User.t() | :operations) :: T.domain_res(Community.t())
  @doc "Runs `update` through the public `Communities` boundary."
  def update(%Community{} = community, args, actor),
    do: Writer.update(community, args, actor)

  @spec sync_base_info(Community.t(), map(), User.t() | :operations) ::
          T.domain_res(Community.t())
  @doc "Synchronizes base info through the `Communities` boundary."
  def sync_base_info(%Community{} = community, args, actor),
    do: Writer.sync_base_info(community, args, actor)

  @spec create_from_application(String.t(), String.t()) :: T.domain_res(term())
  @doc "Creates from application through the `Communities` write boundary."
  def create_from_application(application_ref, operation_ref),
    do: Creation.create_from_application(application_ref, operation_ref)

  @spec run_setup(String.t(), String.t()) :: T.domain_res(term())
  @doc "Runs `run_setup` through the public `Communities` boundary."
  def run_setup(community_ref, operation_ref), do: Setup.run(community_ref, operation_ref)

  @spec retry_setup(String.t(), User.t(), integer()) :: T.domain_res(term())
  @doc "Runs `retry_setup` through the public `Communities` boundary."
  def retry_setup(application_ref, %User{} = reviewer, expected_version),
    do: Setup.retry(application_ref, reviewer, expected_version)

  @spec mark_setup_failed(String.t(), String.t(), term(), integer()) :: T.domain_res(term())
  @doc "Runs `mark_setup_failed` through the public `Communities` boundary."
  def mark_setup_failed(application_ref, operation_ref, reason, attempt),
    do: Setup.mark_failed(application_ref, operation_ref, reason, attempt)

  # Lifecycle commands
  @spec request_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  @doc "Requests reversible Community destruction through the Lifecycle boundary."
  def request_destroy(community_ref, opts \\ []),
    do: Lifecycle.request_destroy(community_ref, opts)

  @spec restore(String.t() | integer(), keyword()) :: T.domain_res(term())
  @doc "Runs `restore` through the public `Communities` boundary."
  def restore(community_ref, opts \\ []), do: Lifecycle.restore(community_ref, opts)

  @spec schedule_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  @doc "Schedules irreversible Community destruction through Lifecycle."
  def schedule_destroy(community_ref, opts \\ []),
    do: Lifecycle.schedule_destroy(community_ref, opts)

  @spec cancel_destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  @doc "Cancels a pending Community destruction during its grace period."
  def cancel_destroy(community_ref, opts \\ []),
    do: Lifecycle.cancel_destroy(community_ref, opts)

  @spec destroy(String.t() | integer(), keyword()) :: T.domain_res(term())
  @doc "Runs `destroy` through the public `Communities` boundary."
  def destroy(community_ref, opts \\ []), do: Lifecycle.destroy(community_ref, opts)

  @spec release_expired_slug_claims(DateTime.t()) :: {non_neg_integer(), nil}
  @doc "Runs `release_expired_slug_claims` through the public `Communities` boundary."
  def release_expired_slug_claims(now), do: SlugClaims.release_expired(now)

  # Members
  @spec members(atom(), Community.t(), map()) :: T.domain_res(T.paged_data())
  @doc "Runs `members` through the public `Communities` boundary."
  def members(type, %Community{} = community, filters),
    do: Members.members(type, community, filters)

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters, %User{} = user) do
    Members.members(type, community, filters, user)
  end

  # Category
  @spec create_category(map(), User.t()) :: T.domain_res(Category.t())
  @doc "Creates category through the `Communities` write boundary."
  def create_category(attrs, %User{} = user), do: Categories.create(attrs, user)

  @spec update_category(String.t(), map()) :: T.domain_res(Category.t())
  @doc "Updates category through the `Communities` write boundary."
  def update_category(community, attrs), do: Categories.update(community, attrs)

  @spec update_category(map()) :: T.domain_res(Category.t())
  def update_category(attrs), do: Categories.update(attrs)

  @spec delete_category(String.t(), T.id()) :: T.domain_res(Category.t())
  @doc "Removes category through the `Communities` boundary."
  def delete_category(community, id), do: Categories.delete(community, id)

  @spec set_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  @doc "Runs `set_category` through the public `Communities` boundary."
  def set_category(%Community{} = community, %Category{} = category) do
    Categories.set(community, category)
  end

  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  @doc "Runs `unset_category` through the public `Communities` boundary."
  def unset_category(%Community{} = community, %Category{} = category) do
    Categories.unset(community, category)
  end

  # Passport
  @spec get_passport(User.t()) :: T.domain_res(map())
  @doc "Returns passport through the `Communities` boundary."
  def get_passport(%User{} = user), do: Passport.get_passport(user)

  @spec stamp_passport(map(), User.t()) :: T.domain_res(map())
  @doc "Runs `stamp_passport` through the public `Communities` boundary."
  def stamp_passport(rules, %User{} = user), do: Passport.stamp_passport(rules, user)

  @spec erase_passport(list(), User.t()) :: T.domain_res(map())
  @doc "Runs `erase_passport` through the public `Communities` boundary."
  def erase_passport(rules, %User{} = user), do: Passport.erase_passport(rules, user)

  @spec delete_passport(User.t()) :: T.domain_res(map())
  @doc "Removes passport through the `Communities` boundary."
  def delete_passport(%User{} = user), do: Passport.delete_passport(user)

  @spec paged_passports(String.t(), String.t()) :: T.domain_res(list())
  @doc "Returns paged passports from the `Communities` read boundary."
  def paged_passports(community, key), do: Passport.paged_passports(community, key)

  @spec all_passport_rules() :: T.domain_res(map())
  @doc "Runs `all_passport_rules` through the public `Communities` boundary."
  def all_passport_rules, do: Passport.all_passport_rules()

  # Moderator
  @spec add_moderator(Community.t(), User.t(), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `add_moderator` through the public `Communities` boundary."
  def add_moderator(%Community{} = community, %User{} = target_user, %User{} = cur_user) do
    Moderator.add(community, target_user, cur_user)
  end

  @spec add_moderators(Community.t(), list(User.t()), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `add_moderators` through the public `Communities` boundary."
  def add_moderators(
        %Community{} = community,
        target_users,
        %User{} = cur_user
      )
      when is_list(target_users) do
    Moderator.add_many(community, target_users, cur_user)
  end

  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  @doc "Removes moderator through the `Communities` boundary."
  def remove_moderator(community, %User{} = target_user, %User{} = cur_user) do
    Moderator.remove(community, target_user, cur_user)
  end

  @spec update_moderator_passport(String.t() | Community.t(), map(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  @doc "Updates moderator passport through the `Communities` write boundary."
  def update_moderator_passport(community, rules, %User{} = target_user, %User{} = cur_user) do
    Moderator.update_passport(community, rules, target_user, cur_user)
  end

  # Subscribe
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `subscribe` through the public `Communities` boundary."
  def subscribe(%Community{} = community, %User{} = user),
    do: Subscribe.subscribe(community, user)

  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `unsubscribe` through the public `Communities` boundary."
  def unsubscribe(%Community{} = community, %User{} = user),
    do: Subscribe.unsubscribe(community, user)

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(Community.t())
  @doc "Runs `subscribe_ifnot` through the public `Communities` boundary."
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    Subscribe.subscribe_ifnot(community, user)
  end

  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  @doc "Runs `subscribe_default_ifnot` through the public `Communities` boundary."
  def subscribe_default_ifnot(%User{} = user), do: Subscribe.subscribe_default_ifnot(user)

  # Count
  @spec update_count(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  @doc "Updates count through the `Communities` write boundary."
  def update_count(%Community{} = community, %User{} = user, type, opt) do
    Count.update(community, user, type, opt)
  end

  @spec update_count(Community.t(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, type), do: Count.update(community, type)

  @spec update_count([Community.t()], atom()) :: T.domain_res(atom())
  def update_count(communities, type) when is_list(communities),
    do: Count.update(communities, type)

  @spec count(Community.t(), atom()) :: T.domain_res(integer())
  @doc "Runs `count` through the public `Communities` boundary."
  def count(%Community{} = community, type), do: Count.count(community, type)

  # Tags
  @spec create_tag(Community.t(), atom(), map(), User.t()) ::
          T.domain_res(CommunityTag.t())
  @doc "Creates tag through the `Communities` write boundary."
  def create_tag(%Community{} = community, thread, attrs, %User{} = user) do
    Tags.create(community, thread, attrs, user)
  end

  @spec update_tag(T.id(), map()) :: T.domain_res(CommunityTag.t())
  @doc "Updates tag through the `Communities` write boundary."
  def update_tag(id, attrs), do: Tags.update(id, attrs)

  @spec create_tag_group(Community.t(), atom(), map()) :: T.domain_res(CommunityTagGroup.t())
  @doc "Creates tag group through the `Communities` write boundary."
  def create_tag_group(%Community{} = community, thread, attrs) do
    Tags.create_group(community, thread, attrs)
  end

  @spec update_tag_group(Community.t(), atom(), T.id(), map()) ::
          T.domain_res(CommunityTagGroup.t())
  @doc "Updates tag group through the `Communities` write boundary."
  def update_tag_group(%Community{} = community, thread, id, attrs) do
    Tags.update_group(community, thread, id, attrs)
  end

  @spec delete_tag_group(Community.t(), atom(), T.id()) :: T.domain_res(CommunityTagGroup.t())
  @doc "Removes tag group through the `Communities` boundary."
  def delete_tag_group(%Community{} = community, thread, id),
    do: Tags.delete_group(community, thread, id)

  @spec delete_tag(T.id()) :: T.domain_res(CommunityTag.t())
  @doc "Removes tag through the `Communities` boundary."
  def delete_tag(id), do: Tags.delete(id)

  @spec set_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  @doc "Runs `set_tag` through the public `Communities` boundary."
  def set_tag(article, id), do: Tags.add(article, id)

  @spec unset_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  @doc "Runs `unset_tag` through the public `Communities` boundary."
  def unset_tag(article, id), do: Tags.remove(article, id)

  @spec set_tags(Community.t(), atom(), Ecto.Schema.t(), map()) :: T.domain_res(Ecto.Schema.t())
  @doc "Runs `set_tags` through the public `Communities` boundary."
  def set_tags(%Community{} = community, thread, article, attrs) do
    Tags.set(community, thread, article, attrs)
  end

  @spec overwrite_tags(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          T.domain_res(Ecto.Schema.t())
  @doc "Runs `overwrite_tags` through the public `Communities` boundary."
  def overwrite_tags(%Community{} = community, thread, article, attrs) do
    Tags.overwrite(community, thread, article, attrs)
  end

  @spec tag_groups(map()) :: T.domain_res(list(CommunityTagGroup.t()))
  @doc "Runs `tag_groups` through the public `Communities` boundary."
  def tag_groups(filter), do: Tags.groups(filter)

  @spec reindex_tags(Community.t() | String.t(), atom(), atom(), list()) :: T.domain_res(atom())
  @doc "Runs `reindex_tags` through the public `Communities` boundary."
  def reindex_tags(community, thread, group, tags) do
    Tags.reindex_in_group(community, thread, group, tags)
  end

  @spec reindex_tags(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(community, thread, tags) do
    Tags.reindex(community, thread, tags)
  end

  @spec reindex_tag_groups(Community.t() | String.t(), atom(), list()) :: T.domain_res(atom())
  @doc "Runs `reindex_tag_groups` through the public `Communities` boundary."
  def reindex_tag_groups(community, thread, groups) do
    Tags.reindex_groups(community, thread, groups)
  end

  @spec tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  @doc "Runs `tag_stats` through the public `Communities` boundary."
  def tag_stats(tag), do: TagStats.get(tag)

  @spec tag_stats(String.t(), atom(), String.t()) :: T.domain_res(term())
  def tag_stats(community, thread, slug), do: TagStats.get(community, thread, slug)

  @spec rebuild_tag_stats(CommunityTag.t() | T.id()) :: T.domain_res(term())
  @doc "Runs `rebuild_tag_stats` through the public `Communities` boundary."
  def rebuild_tag_stats(tag), do: TagStats.rebuild(tag)

  @spec rebuild_tag_stats_for_community(Community.t() | String.t(), atom()) :: T.domain_res(:pass)
  @doc "Runs `rebuild_tag_stats_for_community` through the public `Communities` boundary."
  def rebuild_tag_stats_for_community(community, thread \\ :post) do
    TagStats.rebuild_for_community(community, thread)
  end

  # Count helpers (migrated from CommunityCRUD)
  @spec update_count_field(Community.t() | [Community.t()], atom()) ::
          T.domain_res(Community.t() | :pass)
  @doc "Updates count field through the `Communities` write boundary."
  def update_count_field(%Community{} = community, field) do
    Count.update(community, field)
  end

  def update_count_field(communities, thread) when is_list(communities) do
    Count.update(communities, thread)
  end

  @spec update_inner_id(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  @doc "Updates inner id through the `Communities` write boundary."
  def update_inner_id(%Community{} = community, thread, attrs) do
    Count.update_inner_id(community, thread, attrs)
  end
end
