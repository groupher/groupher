defmodule GroupherServerWeb.Resolvers.Accounts.Sessions do
  @moduledoc """
  Adapts session and identity GraphQL fields to Accounts authentication use cases.

      GraphQL session field -> this resolver -> Accounts session/auth facade
  """
  require GroupherServer.Accounts.Profiles.ErrorCat
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

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

  def signin_oauth(_root, %{provider: provider} = args, _info) do
    Accounts.profiles_signin_oauth(provider, Map.get(args, :browser_session, %{}))
  end

  def refresh_browser_session(_root, %{browser_session_ref: ref}, _info) do
    ref |> Accounts.profiles_refresh_browser_session() |> browser_session_result()
  end

  def revoke_browser_session(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <- Accounts.profiles_revoke_browser_session(ref) do
      {:ok, %{done: true}}
    end
  end

  def browser_sessions(_root, %{browser_session_ref: ref} = args, _info) do
    ref
    |> Accounts.profiles_browser_sessions_for_ref(Map.get(args, :pagi))
    |> browser_session_result()
  end

  def revoke_browser_session_public(
        _root,
        %{browser_session_ref: ref, public_ref: public_ref},
        _info
      ) do
    ref |> Accounts.profiles_revoke_browser_session_public(public_ref) |> browser_session_result()
  end

  def revoke_other_browser_sessions(_root, %{browser_session_ref: ref}, _info) do
    with {:ok, _result} <-
           ref
           |> Accounts.profiles_revoke_other_browser_sessions_for_ref()
           |> browser_session_result() do
      {:ok, %{done: true}}
    end
  end

  def linked_oauth_accounts(_root, _args, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_linked_oauth_accounts(cur_user.login)
  end

  def link_oauth_identity(_root, %{identity: identity}, %{context: %{cur_user: cur_user}}) do
    Accounts.profiles_link_oauth_identity(cur_user.login, identity)
  end

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
