defmodule GroupherServer.CMS.Communities do
  @moduledoc """
  CMS communities facade.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Category, Community, CommunityTag, Thread}
  alias Helper.T

  alias __MODULE__.{
    Apply,
    Categories,
    Count,
    Dashboard,
    List,
    Members,
    Moderator,
    Passport,
    Read,
    Subscribe,
    Tags,
    Threads,
    Write
  }

  # Read
  @spec read(String.t()) :: T.domain_res(Community.t())
  def read(slug), do: Read.read(slug)

  @spec read(String.t(), keyword()) :: T.domain_res(Community.t())
  def read(slug, opt) when is_list(opt), do: Read.read(slug, opt)

  @spec read(String.t(), User.t()) :: T.domain_res(Community.t())
  def read(slug, %User{} = user), do: Read.read(slug, user)

  @spec read(String.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def read(slug, %User{} = user, opt), do: Read.read(slug, user, opt)

  @spec exist?(String.t()) :: T.domain_res(%{exist: boolean()})
  def exist?(slug), do: Read.exist?(slug)

  # List
  @spec paged(map()) :: T.domain_res(T.paged_data())
  def paged(filter), do: List.page(filter)

  @spec paged(map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(filter, %User{} = user), do: List.page(filter, user)

  # Write
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user), do: Write.create(args, user)

  @spec update(Community.t(), map()) :: T.domain_res(Community.t())
  def update(%Community{} = community, args), do: Write.update(community, args)

  @spec delete(String.t() | Community.t()) :: T.domain_res(Community.t())
  def delete(community), do: Write.delete(community)

  # Dashboard
  @spec update_dashboard(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update_dashboard(%Community{} = community, key, args),
    do: Dashboard.update(community, key, args)

  # Apply
  @spec apply(map(), User.t()) :: T.domain_res(Community.t())
  def apply(args, %User{} = user), do: Apply.apply(args, user)

  @spec approve_apply(String.t()) :: T.domain_res(Community.t())
  def approve_apply(slug), do: Apply.approve(slug)

  @spec deny_apply(T.id()) :: T.domain_res(Community.t())
  def deny_apply(id), do: Apply.deny(id)

  @spec has_pending_apply?(User.t()) :: T.domain_res(%{exist: boolean()})
  def has_pending_apply?(%User{} = user), do: Apply.has_pending?(user)

  # Members
  @spec members(atom(), Community.t(), map()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters),
    do: Members.members(type, community, filters)

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters, %User{} = user) do
    Members.members(type, community, filters, user)
  end

  # Category
  @spec create_category(map(), User.t()) :: T.domain_res(Category.t())
  def create_category(attrs, %User{} = user), do: Categories.create(attrs, user)

  @spec update_category(String.t(), map()) :: T.domain_res(Category.t())
  def update_category(community, attrs), do: Categories.update(community, attrs)

  @spec update_category(map()) :: T.domain_res(Category.t())
  def update_category(attrs), do: Categories.update(attrs)

  @spec delete_category(String.t(), T.id()) :: T.domain_res(Category.t())
  def delete_category(community, id), do: Categories.delete(community, id)

  @spec set_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def set_category(%Community{} = community, %Category{} = category) do
    Categories.set(community, category)
  end

  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def unset_category(%Community{} = community, %Category{} = category) do
    Categories.unset(community, category)
  end

  # Thread
  @spec create_thread(String.t(), map()) :: T.domain_res(Thread.t())
  def create_thread(community, attrs), do: Threads.create(community, attrs)

  @spec create_thread(map()) :: T.domain_res(Thread.t())
  def create_thread(attrs), do: Threads.create(attrs)

  @spec set_thread(Community.t(), Thread.t()) :: T.domain_res(Community.t())
  def set_thread(%Community{} = community, %Thread{} = thread) do
    Threads.set(community, thread)
  end

  @spec unset_thread(Community.t(), Thread.t()) :: T.domain_res(Community.t())
  def unset_thread(%Community{} = community, %Thread{} = thread) do
    Threads.unset(community, thread)
  end

  # Passport
  @spec get_passport(User.t()) :: T.domain_res(map())
  def get_passport(%User{} = user), do: Passport.get_passport(user)

  @spec stamp_passport(map(), User.t()) :: T.domain_res(map())
  def stamp_passport(rules, %User{} = user), do: Passport.stamp_passport(rules, user)

  @spec erase_passport(list(), User.t()) :: T.domain_res(map())
  def erase_passport(rules, %User{} = user), do: Passport.erase_passport(rules, user)

  @spec delete_passport(User.t()) :: T.domain_res(map())
  def delete_passport(%User{} = user), do: Passport.delete_passport(user)

  @spec paged_passports(String.t(), String.t()) :: T.domain_res(list())
  def paged_passports(community, key), do: Passport.paged_passports(community, key)

  @spec all_passport_rules() :: T.domain_res(map())
  def all_passport_rules, do: Passport.all_passport_rules()

  # Moderator
  @spec add_moderator(Community.t(), String.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def add_moderator(%Community{} = community, role, %User{} = target_user, %User{} = cur_user) do
    Moderator.add(community, role, target_user, cur_user)
  end

  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def remove_moderator(community, %User{} = target_user, %User{} = cur_user) do
    Moderator.remove(community, target_user, cur_user)
  end

  @spec update_moderator_passport(String.t() | Community.t(), map(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def update_moderator_passport(community, rules, %User{} = target_user, %User{} = cur_user) do
    Moderator.update_passport(community, rules, target_user, cur_user)
  end

  # Subscribe
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user),
    do: Subscribe.subscribe(community, user)

  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user),
    do: Subscribe.unsubscribe(community, user)

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    Subscribe.subscribe_ifnot(community, user)
  end

  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user), do: Subscribe.subscribe_default_ifnot(user)

  # Count
  @spec update_count(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, %User{} = user, type, opt) do
    Count.update(community, user, type, opt)
  end

  @spec update_count(Community.t(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, type), do: Count.update(community, type)

  @spec update_count([Community.t()], atom()) :: T.domain_res(atom())
  def update_count(communities, type) when is_list(communities),
    do: Count.update(communities, type)

  @spec count(Community.t(), atom()) :: T.domain_res(integer())
  def count(%Community{} = community, type), do: Count.count(community, type)

  # Tags
  @spec create_tag(Community.t(), atom(), map(), User.t()) ::
          T.domain_res(CommunityTag.t())
  def create_tag(%Community{} = community, thread, attrs, %User{} = user) do
    Tags.create(community, thread, attrs, user)
  end

  @spec update_tag(T.id(), map()) :: T.domain_res(CommunityTag.t())
  def update_tag(id, attrs), do: Tags.update(id, attrs)

  @spec delete_tag(T.id()) :: T.domain_res(CommunityTag.t())
  def delete_tag(id), do: Tags.delete(id)

  @spec set_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def set_tag(article, id), do: Tags.add(article, id)

  @spec unset_tag(Ecto.Schema.t(), T.id()) :: T.domain_res(Ecto.Schema.t())
  def unset_tag(article, id), do: Tags.remove(article, id)

  @spec set_tags(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          T.domain_res(Ecto.Schema.t())
  def set_tags(%Community{} = community, thread, article, attrs) do
    Tags.set(community, thread, article, attrs)
  end

  @spec overwrite_tags(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          T.domain_res(Ecto.Schema.t())
  def overwrite_tags(%Community{} = community, thread, article, attrs) do
    Tags.overwrite(community, thread, article, attrs)
  end

  @spec paged_tags(map()) :: T.domain_res(T.paged_data())
  def paged_tags(filter), do: Tags.paged(filter)

  @spec reindex_tags(Community.t() | String.t(), atom(), atom(), list()) :: T.domain_res(atom())
  def reindex_tags(community, thread, group, tags) do
    Tags.reindex_in_group(community, thread, group, tags)
  end

  # Count helpers (migrated from CommunityCRUD)
  @spec update_count_field(Community.t() | [Community.t()], atom()) ::
          T.domain_res(Community.t() | :pass)
  def update_count_field(%Community{} = community, field) do
    Count.update(community, field)
  end

  def update_count_field(communities, thread) when is_list(communities) do
    Count.update(communities, thread)
  end

  @spec update_inner_id(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update_inner_id(%Community{} = community, thread, attrs) do
    Count.update_inner_id(community, thread, attrs)
  end
end
