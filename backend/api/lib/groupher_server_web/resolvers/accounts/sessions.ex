defmodule GroupherServerWeb.Resolvers.Accounts.Sessions do
  @moduledoc """
  Adapts session and identity GraphQL fields to Accounts authentication use cases.

      GraphQL session field -> this resolver -> Accounts session/auth facade
  """
  require GroupherServer.Accounts.Profiles.ErrorCat
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  @doc "Returns authentication errors, bootstraps a signed-in session, or reports an anonymous session as invalid."
  def session_state(_root, _args, %{context: %{auth_failure: code}}) do
    {:error, auth_failure_error(code)}
  end

  def session_state(_root, _args, %{context: %{service_auth_failure: code}}) do
    {:error, service_auth_failure_error(code)}
  end

  def session_state(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_session_state(cur_user)
  end

  def session_state(_root, _args, _info) do
    {:ok, %{is_valid: false}}
  end

  @doc "Adapts Auth-only acceptance redemption without disclosing failure details."
  def redeem_production_seed_login(_root, args, _info) do
    case GroupherServer.CMS.production_seed_redeem_login(
           args.credential,
           Map.get(args, :browser_session, %{})
         ) do
      {:ok, result} -> {:ok, result}
      {:error, _} -> {:error, "Acceptance credential unavailable"}
    end
  end

  @doc "Signs in with the provider identity and optional browser metadata, returning session credentials."
  def signin_oauth(_root, %{provider: provider} = args, _info) do
    Accounts.profiles_signin_oauth(
      provider,
      Map.get(args, :browser_session, %{}),
      args.flow_ref,
      Map.get(args, :return_to)
    )
  end

  @doc "Completes an OAuth registration using its verified flow."
  def complete_oauth_registration(_root, args, _info) do
    Accounts.complete_oauth_registration(
      args.flow_ref,
      args.login,
      Map.get(args, :browser_session, %{})
    )
  end

  @doc "Returns the summary of a pending registration flow to Auth."
  def oauth_registration_summary(_root, %{flow_ref: ref}, _info) do
    Accounts.oauth_registration_summary(ref)
  end

  @doc "Lists public OAuth providers and their admission states."
  def oauth_providers(_root, _args, _info) do
    {:ok, Accounts.oauth_provider_list()}
  end

  def oauth_link_start(_root, args, %{context: %{cur_user: user}}) do
    case Accounts.oauth_link_start(user, args) do
      {:ok, _} -> {:ok, %{done: true}}
      error -> error
    end
  end

  def oauth_link_claim(_root, args, %{context: %{cur_user: user}}) do
    Accounts.oauth_link_claim(user, args.ref, args.browser_session_ref, args.provider, args.nonce)
  end

  def oauth_link_verified(_root, args, %{context: %{cur_user: user}}) do
    Accounts.oauth_link_verified(user, args.ref, args.browser_session_ref, args.identity)
  end

  def oauth_link_summary(_root, args, %{context: %{cur_user: user}}) do
    Accounts.oauth_link_summary(user, args.ref, args.browser_session_ref)
  end

  def oauth_link_cancel(_root, args, %{context: %{cur_user: user}}) do
    Accounts.oauth_link_cancel(user, args.ref, args.browser_session_ref)
  end

  def oauth_link_confirm(_root, args, %{context: %{cur_user: user}}) do
    Accounts.oauth_link_confirm(
      user,
      args.ref,
      args.browser_session_ref,
      args.provider,
      args.provider_id
    )
  end

  @doc "Refreshes the access token by session reference and translates session errors for GraphQL."
  def refresh_browser_session(_root, %{browser_session_ref: ref}, _info) do
    ref |> Accounts.profiles_refresh_browser_session() |> browser_session_result()
  end

  @doc "Revokes the session by reference and returns a done flag on success."
  def revoke_browser_session(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <- Accounts.profiles_revoke_browser_session(ref) do
      {:ok, %{done: true}}
    end
  end

  @doc "Lists the account's sessions using the current session reference and requested pagination."
  def browser_sessions(_root, %{browser_session_ref: ref} = args, _info) do
    ref
    |> Accounts.profiles_browser_sessions_for_ref(Map.get(args, :pagi))
    |> browser_session_result()
  end

  @doc "Revokes another session by public reference in the account identified by the current session."
  def revoke_browser_session_public(
        _root,
        %{browser_session_ref: ref, public_ref: public_ref},
        _info
      ) do
    ref |> Accounts.profiles_revoke_browser_session_public(public_ref) |> browser_session_result()
  end

  @doc "Revokes the account's other sessions, retaining the one identified by the supplied reference."
  def revoke_other_browser_sessions(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <-
           ref
           |> Accounts.profiles_revoke_other_browser_sessions_for_ref()
           |> browser_session_result() do
      {:ok, %{done: true}}
    end
  end

  @doc "Lists OAuth bindings for the signed-in user's login."
  def linked_oauth_accounts(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_linked_oauth_accounts(cur_user.login)
  end

  @doc "Unlinks the binding identified by public reference from the signed-in account."
  def unlink_oauth_identity(_root, %{public_ref: public_ref}, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_unlink_oauth_identity(cur_user.login, public_ref)
  end

  defp browser_session_result({:error, reason}) do
    {:error, session_error(error_reason(reason))}
  end

  defp browser_session_result(result) do
    result
  end

  defp error_reason(ErrorCat.error_pattern(reason: reason)) do
    reason
  end

  defp error_reason(reason) when is_atom(reason) do
    reason
  end

  defp error_reason(_reason) do
    :unknown
  end

  defp auth_failure_error(code) do
    token_invalid = GroupherServer.Auth.contract_token_invalid()
    session_revoked = GroupherServer.Auth.contract_session_revoked()

    case code do
      ^token_invalid ->
        Accounts.profiles_error_cat_invalid_browser_access_claims(
          "Authorize: browser token is invalid"
        )

      ^session_revoked ->
        Accounts.profiles_error_cat_session_revoked("Browser Session revoked.")

      _ ->
        Accounts.profiles_error_cat_invalid_browser_access_claims(
          "Authorize: browser token is invalid"
        )
    end
  end

  defp service_auth_failure_error(code) do
    if code == GroupherServer.Auth.contract_service_token_invalid() do
      GroupherServerWeb.ErrorCat.invalid_service_token(
        "Authorize: service identity could not be verified"
      )
    else
      GroupherServerWeb.ErrorCat.service_auth("Authorize: service identity could not be verified")
    end
  end

  defp session_error(:session_expired) do
    Accounts.profiles_error_cat_session_expired("Browser Session expired.")
  end

  defp session_error(:session_revoked) do
    Accounts.profiles_error_cat_session_revoked("Browser Session revoked.")
  end

  defp session_error(:session_not_found) do
    Accounts.profiles_error_cat_session_revoked("Browser Session no longer exists.")
  end

  defp session_error(:current_session) do
    Accounts.profiles_error_cat_current_session(
      "The current Browser Session cannot be revoked here."
    )
  end

  defp session_error(:account_blocked) do
    Accounts.profiles_error_cat_account_blocked("Account is blocked.")
  end

  defp session_error(_reason) do
    Accounts.profiles_error_cat_session_unavailable("Browser Session operation failed.")
  end
end
