defmodule GroupherServer.Accounts.Profiles.Commands.SignInOauth do
  @moduledoc """
  Signs in through an existing OAuth identity or registers its account.

  Registration row writes run in the generic pipeline transaction. Browser
  session creation and welcome notifications are present-stage effects after
  the transaction commits.

      OAuth provider -> prepare -> identity lock -> registration -> browser session
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Profiles.{BrowserSessions, Effects, Oauth}
  alias Helper.ORM.AdvisoryLock

  @pipeline operation: :accounts_profile_sign_in_oauth,
            access: :open,
            target: :provider,
            params: [:browser_session_metadata]

  direct_pipeline execute_pipeline(provider, browser_session_metadata) do
    prepare(fn ->
      provider = Oauth.normalize_oauth_provider(provider)

      case Oauth.find_oauth_provider(provider) do
        {:ok, %{user: user}} ->
          {:ok, %{provider: provider, user: user, newly_registered: false}}

        {:error, _reason} ->
          {:ok, %{provider: provider}}
      end
    end)

    lifecycle(fn %{provider: provider} = state ->
      with {:ok, :acquired} <-
             AdvisoryLock.acquire!("oauth:#{provider.provider}:#{provider.provider_id}") do
        case Oauth.find_oauth_provider(provider) do
          {:ok, %{user: user}} ->
            {:ok, Map.merge(state, %{user: user, newly_registered: false})}

          {:error, _reason} ->
            {:ok, state}
        end
      end
    end)

    change(fn
      %{user: _user, newly_registered: false} = state, _operation_ref ->
        {:ok, state}

      %{provider: provider}, _operation_ref ->
        case Oauth.register_in_transaction(provider) do
          {:ok, user} ->
            {:ok, %{provider: provider, user: user, newly_registered: true}}

          {:error, {step, reason}} when step in [:create_user, :create_profile] ->
            case Oauth.find_oauth_provider(provider) do
              {:ok, %{user: user}} ->
                {:ok, %{provider: provider, user: user, newly_registered: false}}

              {:error, _lookup_reason} ->
                {:error, reason}
            end

          {:error, {_step, reason}} ->
            {:error, reason}
        end
    end)

    present(fn %{user: user, newly_registered: newly_registered} ->
      if newly_registered do
        _ = Effects.oauth_registration_completed(user)
      end

      BrowserSessions.create(user, browser_session_metadata)
    end)
  end

  @doc """
  Signs in an OAuth identity and creates a browser session.

  ## Examples

      Accounts.Profiles.Commands.SignInOauth.run(provider, %{user_agent: "browser"})
  """
  def run(provider, browser_session_metadata \\ %{}) do
    execute_pipeline(provider, browser_session_metadata)
  end
end
