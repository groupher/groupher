defmodule GroupherServer.Accounts.Profiles do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Profile
  alias GroupherServer.Accounts.Model.User

  @spec read_user(User.t()) :: T.domain_res(User.t())
  def read_user(user), do: Profile.read_user(user)

  @spec read_user(User.t(), User.t()) :: T.domain_res(User.t())
  def read_user(user, cur_user), do: Profile.read_user(user, cur_user)

  @spec paged_users(map()) :: T.domain_res(T.paged_users())
  def paged_users(filter), do: Profile.paged_users(filter)

  @spec paged_users(map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_users(filter, user), do: Profile.paged_users(filter, user)

  @spec update_profile(User.t(), map()) :: T.gq_result(User.t())
  def update_profile(user, attrs), do: Profile.update_profile(user, attrs)

  @spec update_subscribe_state(User.t()) :: T.domain_res(User.t())
  def update_subscribe_state(user), do: Profile.update_subscribe_state(user)

  @spec signin_oauth(map()) :: T.domain_res(User.t())
  def signin_oauth(provider), do: Profile.signin_oauth(provider)

  @spec link_oauth(String.t(), map()) :: T.domain_res(User.t())
  def link_oauth(login, provider), do: Profile.link_oauth(login, provider)

  @spec unlink_oauth(String.t(), map()) :: T.domain_res(User.t())
  def unlink_oauth(login, provider), do: Profile.unlink_oauth(login, provider)

  @spec default_subscribed_communities(map()) :: T.domain_res(T.paged_data())
  def default_subscribed_communities(filter), do: Profile.default_subscribed_communities(filter)

  @spec subscribed_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def subscribed_communities(user, filter), do: Profile.subscribed_communities(user, filter)
end
