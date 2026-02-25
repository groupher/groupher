defmodule GroupherServer.Accounts.Profiles do
  @moduledoc """
  Accounts profiles facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{List, Oauth, Subscribe, UserRead}

  @spec read_user(User.t()) :: T.domain_res(User.t())
  def read_user(%User{} = user), do: UserRead.read_user(user)

  @spec read_user(User.t(), User.t()) :: T.domain_res(User.t())
  def read_user(%User{} = user, %User{} = cur_user), do: UserRead.read_user(user, cur_user)

  @spec paged_users(map()) :: T.domain_res(T.paged_users())
  def paged_users(filter), do: List.paged_users(filter)

  @spec paged_users(map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_users(filter, %User{} = user), do: List.paged_users(filter, user)

  @spec update_profile(User.t(), map()) :: T.gq_result(User.t())
  def update_profile(%User{} = user, attrs), do: UserRead.update_profile(user, attrs)

  @spec update_subscribe_state(User.t()) :: T.domain_res(User.t())
  def update_subscribe_state(%User{} = user), do: Subscribe.update_subscribe_state(user)

  @spec signin_oauth(map()) :: T.domain_res(User.t())
  def signin_oauth(provider), do: Oauth.signin_oauth(provider)

  @spec link_oauth(String.t(), map()) :: T.domain_res(User.t())
  def link_oauth(login, provider), do: Oauth.link_oauth(login, provider)

  @spec unlink_oauth(String.t(), map()) :: T.domain_res(User.t())
  def unlink_oauth(login, provider), do: Oauth.unlink_oauth(login, provider)

  @spec default_subscribed_communities(map()) :: T.domain_res(T.paged_data())
  def default_subscribed_communities(filter), do: List.default_subscribed_communities(filter)

  @spec subscribed_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def subscribed_communities(%User{} = user, filter), do: List.subscribed_communities(user, filter)
end
