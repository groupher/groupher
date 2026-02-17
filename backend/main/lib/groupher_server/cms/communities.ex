defmodule GroupherServer.CMS.Communities do
  @moduledoc """
  CMS communities facade.
  """

  alias Helper.Types, as: T
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, Category, Thread}

  alias __MODULE__.{
    Read,
    List,
    Write,
    Dashboard,
    Apply,
    Members,
    Moderator,
    Subscribe,
    Count
  }

  alias __MODULE__.Category, as: CategoryOp
  alias __MODULE__.Thread, as: ThreadOp

  # Read
  @spec read(String.t()) :: T.domain_res(Community.t())
  def read(slug) do
    Read.read(slug)
  end

  @spec read(String.t(), keyword()) :: T.domain_res(Community.t())
  def read(slug, opt) when is_list(opt) do
    Read.read(slug, opt)
  end

  @spec read(String.t(), User.t()) :: T.domain_res(Community.t())
  def read(slug, %User{} = user) do
    Read.read(slug, user)
  end

  @spec read(String.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def read(slug, %User{} = user, opt) do
    Read.read(slug, user, opt)
  end

  @spec exist?(String.t()) :: T.domain_res(term())
  def exist?(slug) do
    Read.exist?(slug)
  end

  # List
  @spec paged(map()) :: T.domain_res(T.paged_data())
  def paged(filter) do
    List.paged(filter)
  end

  @spec paged(map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(filter, %User{} = user) do
    List.paged(filter, user)
  end

  # Write
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user) do
    Write.create(args, user)
  end

  @spec update(Community.t(), map()) :: T.domain_res(Community.t())
  def update(%Community{} = community, args) do
    Write.update(community, args)
  end

  @spec delete(String.t() | Community.t()) :: T.domain_res(term())
  def delete(community) do
    Write.delete(community)
  end

  # Dashboard
  @spec update_dashboard(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update_dashboard(%Community{} = community, key, args) do
    Dashboard.update(community, key, args)
  end

  # Apply
  @spec apply(map(), User.t()) :: T.domain_res(Community.t())
  def apply(args, %User{} = user) do
    Apply.apply(args, user)
  end

  @spec approve_apply(String.t()) :: T.domain_res(Community.t())
  def approve_apply(slug) do
    Apply.approve(slug)
  end

  @spec deny_apply(T.id()) :: T.domain_res(Community.t())
  def deny_apply(id) do
    Apply.deny(id)
  end

  @spec has_pending_apply?(User.t()) :: T.domain_res(term())
  def has_pending_apply?(%User{} = user) do
    Apply.has_pending?(user)
  end

  # Members
  @spec members(atom(), Community.t(), map()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters) do
    Members.members(type, community, filters)
  end

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(T.paged_data())
  def members(type, %Community{} = community, filters, %User{} = user) do
    Members.members(type, community, filters, user)
  end

  # Category
  @spec create_category(map(), User.t()) :: T.domain_res(Category.t())
  def create_category(attrs, %User{} = user) do
    CategoryOp.create(attrs, user)
  end

  @spec update_category(map()) :: T.domain_res(Category.t())
  def update_category(attrs) do
    CategoryOp.update(attrs)
  end

  @spec set_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def set_category(%Community{} = community, %Category{} = category) do
    CategoryOp.set(community, category)
  end

  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(Community.t())
  def unset_category(%Community{} = community, %Category{} = category) do
    CategoryOp.unset(community, category)
  end

  # Thread
  @spec create_thread(map()) :: T.domain_res(Thread.t())
  def create_thread(attrs) do
    ThreadOp.create(attrs)
  end

  @spec set_thread(Community.t(), Thread.t()) :: T.domain_res(Community.t())
  def set_thread(%Community{} = community, %Thread{} = thread) do
    ThreadOp.set(community, thread)
  end

  @spec unset_thread(Community.t(), Thread.t()) :: T.domain_res(Community.t())
  def unset_thread(%Community{} = community, %Thread{} = thread) do
    ThreadOp.unset(community, thread)
  end

  # Moderator
  @spec add_moderator(Community.t(), term(), User.t(), User.t()) :: T.domain_res(Community.t())
  def add_moderator(%Community{} = community, role, %User{} = target_user, %User{} = cur_user) do
    Moderator.add(community, role, target_user, cur_user)
  end

  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def remove_moderator(community, %User{} = target_user, %User{} = cur_user) do
    Moderator.remove(community, target_user, cur_user)
  end

  @spec update_moderator_passport(String.t() | Community.t(), term(), User.t(), User.t()) ::
          T.domain_res(Community.t())
  def update_moderator_passport(community, rules, %User{} = target_user, %User{} = cur_user) do
    Moderator.update_passport(community, rules, target_user, cur_user)
  end

  # Subscribe
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user) do
    Subscribe.subscribe(community, user)
  end

  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user) do
    Subscribe.unsubscribe(community, user)
  end

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    Subscribe.subscribe_ifnot(community, user)
  end

  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user) do
    Subscribe.subscribe_default_ifnot(user)
  end

  # Count
  @spec update_count(Community.t(), User.t(), atom(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, %User{} = user, type, opt) do
    Count.update(community, user, type, opt)
  end

  @spec update_count(Community.t(), atom()) :: T.domain_res(Community.t())
  def update_count(%Community{} = community, type) do
    Count.update(community, type)
  end

  @spec update_count([Community.t()], atom()) :: T.domain_res(atom())
  def update_count(communities, type) when is_list(communities) do
    Count.update(communities, type)
  end

  @spec count(Community.t(), atom()) :: T.domain_res(integer())
  def count(%Community{} = community, type) do
    Count.count(community, type)
  end
end
