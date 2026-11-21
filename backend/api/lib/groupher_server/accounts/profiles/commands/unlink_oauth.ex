defmodule GroupherServer.Accounts.Profiles.Commands.UnlinkOauth do
  @moduledoc """
  Owns unlinking one verified OAuth identity from an existing account.

      UnlinkOauth command -> direct_pipeline runner -> Oauth row primitives -> Effects
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Model.User
  alias Accounts.Profiles.{Effects, Oauth}

  @pipeline operation: :accounts_profile_unlink_oauth,
            access: :open,
            target: :login,
            params: [:provider]

  direct_pipeline execute_pipeline(login, provider) do
    change(fn _login, _operation_ref -> Oauth.unlink_in_transaction(login, provider) end)

    present(fn user ->
      _ = Effects.revalidate_user(user)
      {:ok, user}
    end)
  end

  @doc """
  Removes an OAuth provider while preserving at least one login method.

  ## Examples

      Accounts.Profiles.Commands.UnlinkOauth.run("alice", provider_payload)
  """
  @spec run(String.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def run(login, provider) do
    execute_pipeline(login, provider)
  end
end
