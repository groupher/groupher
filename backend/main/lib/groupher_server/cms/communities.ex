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
    Category,
    Thread,
    Moderator,
    Subscribe,
    Count
  }

  # Read
  @spec read(String.t()) :: T.domain_res(term())
  defdelegate read(slug), to: Read

  @spec read(String.t(), keyword()) :: T.domain_res(term())
  defdelegate read(slug, opt), to: Read

  @spec read(String.t(), User.t()) :: T.domain_res(term())
  defdelegate read(slug, user), to: Read

  @spec read(String.t(), User.t(), keyword()) :: T.domain_res(term())
  defdelegate read(slug, user, opt), to: Read

  @spec exist?(String.t()) :: T.domain_res(term())
  defdelegate exist?(slug), to: Read

  # List
  @spec paged(map()) :: T.domain_res(term())
  defdelegate paged(filter), to: List

  @spec paged(map(), User.t()) :: T.domain_res(term())
  defdelegate paged(filter, user), to: List

  # Write
  @spec create(map(), User.t()) :: T.domain_res(term())
  defdelegate create(args, user), to: Write

  @spec update(Community.t(), map()) :: T.domain_res(term())
  defdelegate update(community, args), to: Write

  @spec delete(String.t() | Community.t()) :: T.domain_res(term())
  defdelegate delete(community), to: Write

  # Dashboard
  @spec update_dashboard(Community.t(), atom(), map()) :: T.domain_res(term())
  defdelegate update_dashboard(community, key, args), to: Dashboard

  # Apply
  @spec apply(map(), User.t()) :: T.domain_res(term())
  defdelegate apply(args, user), to: Apply

  @spec approve_apply(String.t()) :: T.domain_res(term())
  defdelegate approve_apply(slug), to: Apply

  @spec deny_apply(T.id()) :: T.domain_res(term())
  defdelegate deny_apply(id), to: Apply

  @spec has_pending_apply?(User.t()) :: T.domain_res(term())
  defdelegate has_pending_apply?(user), to: Apply

  # Members
  @spec members(atom(), Community.t(), map()) :: T.domain_res(term())
  defdelegate members(type, community, filters), to: Members

  @spec members(atom(), Community.t(), map(), User.t()) :: T.domain_res(term())
  defdelegate members(type, community, filters, user), to: Members

  # Category
  @spec create_category(map(), User.t()) :: T.domain_res(term())
  defdelegate create_category(attrs, user), to: Category

  @spec update_category(map()) :: T.domain_res(term())
  defdelegate update_category(attrs), to: Category

  @spec set_category(Community.t(), Category.t()) :: T.domain_res(term())
  defdelegate set_category(community, category), to: Category

  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(term())
  defdelegate unset_category(community, category), to: Category

  # Thread
  @spec create_thread(map()) :: T.domain_res(term())
  defdelegate create_thread(attrs), to: Thread

  @spec set_thread(Community.t(), Thread.t()) :: T.domain_res(term())
  defdelegate set_thread(community, thread), to: Thread

  @spec unset_thread(Community.t(), Thread.t()) :: T.domain_res(term())
  defdelegate unset_thread(community, thread), to: Thread

  # Moderator
  @spec add_moderator(Community.t(), term(), User.t(), User.t()) :: T.domain_res(term())
  defdelegate add_moderator(community, role, target_user, cur_user), to: Moderator, as: :add

  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) :: T.domain_res(term())
  defdelegate remove_moderator(community, target_user, cur_user), to: Moderator, as: :remove

  @spec update_moderator_passport(String.t() | Community.t(), term(), User.t(), User.t()) ::
          T.domain_res(term())
  defdelegate update_moderator_passport(community, rules, target_user, cur_user),
    to: Moderator,
    as: :update_passport

  # Subscribe
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(term())
  defdelegate subscribe(community, user), to: Subscribe

  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(term())
  defdelegate unsubscribe(community, user), to: Subscribe

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(term())
  defdelegate subscribe_ifnot(community, user), to: Subscribe

  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(term())
  defdelegate subscribe_default_ifnot(user), to: Subscribe

  # Count
  @spec update_count(Community.t(), User.t(), atom(), atom()) :: T.domain_res(term())
  defdelegate update_count(community, user, type, opt), to: Count, as: :update

  @spec update_count(Community.t(), atom()) :: T.domain_res(term())
  defdelegate update_count(community, type), to: Count, as: :update

  @spec update_count([Community.t()], atom()) :: T.domain_res(term())
  defdelegate update_count(communities, type), to: Count, as: :update

  @spec count(Community.t(), atom()) :: T.domain_res(term())
  defdelegate count(community, type), to: Count
end
