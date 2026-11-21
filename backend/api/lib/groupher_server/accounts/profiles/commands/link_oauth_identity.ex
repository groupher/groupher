defmodule GroupherServer.Accounts.Profiles.Commands.LinkOauthIdentity do
  @moduledoc """
  Owns linking an OAuth identity and returning the canonical linked-account view.

      LinkOauthIdentity -> LinkOauth transaction -> Query projection
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts

  alias Accounts.Profiles.{Effects, Oauth, Query}

  @pipeline operation: :accounts_profile_link_oauth_identity,
            access: :open,
            target: :login,
            params: [:provider]

  direct_pipeline execute_pipeline(login, provider) do
    change(fn _login, _operation_ref -> Oauth.link_in_transaction(login, provider) end)

    present(fn user ->
      _ = Effects.revalidate_user(user)
      Query.linked_oauth_accounts(login)
    end)
  end

  @doc """
  Links a verified identity and returns linked-account projections.

  ## Examples

      Accounts.Profiles.Commands.LinkOauthIdentity.run("alice", provider_payload)
  """
  @spec run(String.t(), map()) :: {:ok, map()} | {:error, term()}
  def run(login, provider) do
    execute_pipeline(login, provider)
  end
end
