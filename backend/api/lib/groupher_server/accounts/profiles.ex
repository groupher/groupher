defmodule GroupherServer.Accounts.Profiles do
  @moduledoc """
  Public account boundary for profiles, browser Sessions, OAuth, and subscriptions.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Profiles
        -> Repo
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{BrowserSessions, List, Oauth, Subscribe, UserRead}

  @spec read_user(User.t()) :: T.domain_res(User.t())
  @doc "Runs `read_user` through the public `Profiles` boundary."
  def read_user(%User{} = user), do: UserRead.read_user(user)

  @doc "Returns an opaque, stable subject for service-to-user delegation."
  @spec delegation_subject(User.t()) :: String.t()
  def delegation_subject(%User{id: id}) do
    digest = :crypto.hash(:sha256, "groupher:user:" <> to_string(id))
    "user:" <> Base.url_encode64(digest, padding: false)
  end

  @spec read_user(User.t(), User.t()) :: T.domain_res(User.t())
  def read_user(%User{} = user, %User{} = cur_user), do: UserRead.read_user(user, cur_user)

  @spec paged_users(map()) :: T.domain_res(T.paged_users())
  @doc "Returns paged users from the `Profiles` read boundary."
  def paged_users(filter), do: List.paged_users(filter)

  @spec paged_users(map(), User.t()) :: T.domain_res(T.paged_users())
  def paged_users(filter, %User{} = user), do: List.paged_users(filter, user)

  @spec update_profile(User.t(), map()) :: T.gq_result(User.t())
  @doc "Updates profile through the `Profiles` write boundary."
  def update_profile(%User{} = user, attrs), do: UserRead.update_profile(user, attrs)

  @spec update_subscribe_state(User.t()) :: T.domain_res(User.t())
  @doc "Updates subscribe state through the `Profiles` write boundary."
  def update_subscribe_state(%User{} = user), do: Subscribe.update_subscribe_state(user)

  @spec signin_oauth(map(), map()) :: T.domain_res(map())
  @doc "Runs `signin_oauth` through the public `Profiles` boundary."
  def signin_oauth(provider, browser_session_metadata \\ %{}),
    do: Oauth.signin_oauth(provider, browser_session_metadata)

  @doc "Runs `refresh_browser_session` through the public `Profiles` boundary."
  def refresh_browser_session(ref), do: BrowserSessions.refresh(ref)
  @doc "Runs `revoke_browser_session` through the public `Profiles` boundary."
  def revoke_browser_session(ref), do: BrowserSessions.revoke_current(ref)
  @doc "Runs `browser_sessions` through the public `Profiles` boundary."
  def browser_sessions(%User{} = user, current_ref), do: BrowserSessions.list(user, current_ref)
  @doc "Runs `browser_sessions_for_ref` through the public `Profiles` boundary."
  def browser_sessions_for_ref(current_ref), do: BrowserSessions.list_for_ref(current_ref)

  @doc "Runs `revoke_browser_session_public` through the public `Profiles` boundary."
  def revoke_browser_session_public(current_ref, public_ref),
    do: BrowserSessions.revoke_public_for_ref(current_ref, public_ref)

  @doc "Runs `revoke_other_browser_sessions` through the public `Profiles` boundary."
  def revoke_other_browser_sessions(%User{} = user, current_ref),
    do: BrowserSessions.revoke_other_sessions(user, current_ref)

  @doc "Runs `revoke_other_browser_sessions_for_ref` through the public `Profiles` boundary."
  def revoke_other_browser_sessions_for_ref(current_ref),
    do: BrowserSessions.revoke_other_for_ref(current_ref)

  @spec link_oauth(String.t(), map()) :: T.domain_res(User.t())
  @doc "Runs `link_oauth` through the public `Profiles` boundary."
  def link_oauth(login, provider), do: Oauth.link_oauth(login, provider)

  @spec unlink_oauth(String.t(), map()) :: T.domain_res(User.t())
  @doc "Runs `unlink_oauth` through the public `Profiles` boundary."
  def unlink_oauth(login, provider), do: Oauth.unlink_oauth(login, provider)

  @spec linked_oauth_accounts(String.t()) :: T.domain_res(map())
  @doc "Runs `linked_oauth_accounts` through the public `Profiles` boundary."
  def linked_oauth_accounts(login), do: Oauth.linked_oauth_accounts(login)

  @spec link_oauth_identity(String.t(), map()) :: T.domain_res(map())
  @doc "Runs `link_oauth_identity` through the public `Profiles` boundary."
  def link_oauth_identity(login, provider), do: Oauth.link_oauth_identity(login, provider)

  @spec unlink_oauth_identity(String.t(), String.t()) :: T.domain_res(map())
  @doc "Runs `unlink_oauth_identity` through the public `Profiles` boundary."
  def unlink_oauth_identity(login, public_ref),
    do: Oauth.unlink_oauth_identity(login, public_ref)

  @spec default_subscribed_communities(map()) :: T.domain_res(T.paged_data())
  @doc "Runs `default_subscribed_communities` through the public `Profiles` boundary."
  def default_subscribed_communities(filter), do: List.default_subscribed_communities(filter)

  @spec subscribed_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  @doc "Runs `subscribed_communities` through the public `Profiles` boundary."
  def subscribed_communities(%User{} = user, filter),
    do: List.subscribed_communities(user, filter)
end
