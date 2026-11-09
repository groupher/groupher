defmodule GroupherServer.Accounts.Profiles do
  @moduledoc """
  Public account boundary for profiles, browser Sessions, OAuth, and subscriptions.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Query / Commands / Projection / Effects
           -> Persist
  """

  alias __MODULE__.{BrowserSessions, Commands, Projection, Query, SessionState}
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc """
  Returns the public profile projection for a user.

  ## Examples

      Accounts.Profiles.user(user)
  """
  @spec user(User.t()) :: T.domain_res(User.t())
  def user(%User{} = user), do: Query.profile(user)

  @doc """
  Returns an opaque, stable subject for service-to-user delegation.

  ## Examples

      Accounts.Profiles.delegation_subject(user)
  """
  @spec delegation_subject(User.t()) :: String.t()
  def delegation_subject(%User{id: id}) do
    digest = :crypto.hash(:sha256, "groupher:user:" <> to_string(id))
    "user:" <> Base.url_encode64(digest, padding: false)
  end

  @doc """
  Bootstraps account defaults and returns the authenticated session state.

  ## Examples

      Accounts.Profiles.session_state(user)
  """
  @spec session_state(User.t()) :: T.domain_res(map())
  def session_state(%User{} = user), do: SessionState.bootstrap(user)

  @doc """
  Returns a viewer-aware public profile projection.

  ## Examples

      Accounts.Profiles.user(user, viewer)
  """
  @spec user(User.t(), User.t()) :: T.domain_res(User.t())
  def user(%User{} = user, %User{} = cur_user), do: Query.profile(user, cur_user)

  @doc """
  Refreshes one persisted contribution projection from an authoritative digest.

  ## Examples

      Profiles.refresh_contributions(user.id, digest)
  """
  @spec refresh_contributions(integer(), map()) :: T.domain_res(User.t())
  def refresh_contributions(user_id, digest) when is_integer(user_id) and is_map(digest) do
    Projection.refresh_contributions(user_id, digest)
  end

  @doc """
  Pages public user profiles using the supplied Pagi position.

  ## Examples

      Accounts.Profiles.paged_users(%{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate paged_users(filter, pagi), to: Query

  @doc """
  Pages public user profiles with the requesting viewer's follow state.

  ## Examples

      Accounts.Profiles.paged_users(%{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}, viewer)
  """
  defdelegate paged_users(filter, pagi, viewer), to: Query

  @doc """
  Returns the bounded default Community suggestions, including Home when available.

  ## Examples

      Accounts.Profiles.default_community_suggestions()
  """
  defdelegate default_community_suggestions(), to: Query

  @doc """
  Pages Communities the account actually subscribes to.

  ## Examples

      Accounts.Profiles.subscribed_communities(user, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})
  """
  defdelegate subscribed_communities(user, filter, pagi), to: Query

  @doc """
  Updates editable profile attributes through the account write boundary.

  ## Examples

      Accounts.Profiles.update_profile(user, %{nickname: "Alice"})
  """
  @spec update_profile(User.t(), map()) :: T.gq_result(User.t())
  def update_profile(%User{} = user, attrs), do: Commands.UpdateProfile.run(user, attrs)

  @doc """
  Updates the user's default subscription state.

  ## Examples

      Accounts.Profiles.update_subscribe_state(user)
  """
  @spec update_subscribe_state(User.t()) :: T.domain_res(User.t())
  def update_subscribe_state(%User{} = user), do: Commands.UpdateSubscribeState.run(user)

  @doc """
  Signs in through a verified OAuth provider response.

  ## Examples

      Accounts.Profiles.signin_oauth(provider_payload, %{ip: ip_address})
  """
  @spec signin_oauth(map(), map()) :: T.domain_res(map())
  def signin_oauth(provider, browser_session_metadata \\ %{}) do
    Commands.SignInOauth.run(provider, browser_session_metadata)
  end

  @doc """
  Refreshes an existing browser session reference.

  ## Examples

      Accounts.Profiles.refresh_browser_session(session_ref)
  """
  def refresh_browser_session(ref), do: BrowserSessions.refresh(ref)

  @doc """
  Revokes the browser session identified by a reference.

  ## Examples

      Accounts.Profiles.revoke_browser_session(session_ref)
  """
  def revoke_browser_session(ref), do: BrowserSessions.revoke_current(ref)

  @doc """
  Revokes a browser session when its production seed run closes.

  ## Examples

      Accounts.Profiles.revoke_seed_browser_session(session_ref)
      #=> {:ok, :revoked} | {:ok, :already_revoked}
  """
  def revoke_seed_browser_session(ref), do: BrowserSessions.revoke_seed_run(ref)

  @doc """
  Lists browser sessions for a user and marks the current session.

  ## Examples

      Accounts.Profiles.browser_sessions(user, current_session_ref, nil)
  """
  def browser_sessions(%User{} = user, current_ref, pagi) do
    BrowserSessions.list(user, current_ref, pagi)
  end

  @doc """
  Lists browser sessions associated with a session reference.

  ## Examples

      Accounts.Profiles.browser_sessions_for_ref(current_session_ref, nil)
  """
  def browser_sessions_for_ref(current_ref, pagi) do
    BrowserSessions.list_for_ref(current_ref, pagi)
  end

  @doc """
  Revokes one public browser-session reference.

  ## Examples

      Accounts.Profiles.revoke_browser_session_public(current_session_ref, public_ref)
  """
  def revoke_browser_session_public(current_ref, public_ref) do
    BrowserSessions.revoke_public_for_ref(current_ref, public_ref)
  end

  @doc """
  Revokes all of a user's other browser sessions.

  ## Examples

      Accounts.Profiles.revoke_other_browser_sessions(user, current_session_ref)
  """
  def revoke_other_browser_sessions(%User{} = user, current_ref) do
    BrowserSessions.revoke_other_sessions(user, current_ref)
  end

  @doc """
  Revokes other sessions associated with a public session reference.

  ## Examples

      Accounts.Profiles.revoke_other_browser_sessions_for_ref(current_session_ref)
  """
  def revoke_other_browser_sessions_for_ref(current_ref) do
    BrowserSessions.revoke_other_for_ref(current_ref)
  end

  @doc """
  Links a verified OAuth provider identity to an account.

  ## Examples

      Accounts.Profiles.link_oauth("alice", provider_payload)
  """
  @spec link_oauth(String.t(), map()) :: T.domain_res(User.t())
  def link_oauth(login, provider), do: Commands.LinkOauth.run(login, provider)

  @doc """
  Removes an OAuth provider link from an account.

  ## Examples

      Accounts.Profiles.unlink_oauth("alice", provider_payload)
  """
  @spec unlink_oauth(String.t(), map()) :: T.domain_res(User.t())
  def unlink_oauth(login, provider), do: Commands.UnlinkOauth.run(login, provider)

  @doc """
  Returns the OAuth identities linked to an account.

  ## Examples

      Accounts.Profiles.linked_oauth_accounts("alice")
  """
  @spec linked_oauth_accounts(String.t()) :: T.domain_res(map())
  def linked_oauth_accounts(login), do: Query.linked_oauth_accounts(login)

  @doc """
  Links one provider identity using its login and verified provider data.

  ## Examples

      Accounts.Profiles.link_oauth_identity("alice", provider_payload)
  """
  @spec link_oauth_identity(String.t(), map()) :: T.domain_res(map())
  def link_oauth_identity(login, provider) do
    Commands.LinkOauthIdentity.run(login, provider)
  end

  @doc """
  Unlinks one OAuth identity by its public reference.

  ## Examples

      Accounts.Profiles.unlink_oauth_identity("alice", public_ref)
  """
  @spec unlink_oauth_identity(String.t(), String.t()) :: T.domain_res(map())
  def unlink_oauth_identity(login, public_ref) do
    Commands.UnlinkOauthIdentity.run(login, public_ref)
  end
end
