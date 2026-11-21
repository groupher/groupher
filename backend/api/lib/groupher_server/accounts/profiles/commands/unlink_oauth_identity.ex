defmodule GroupherServer.Accounts.Profiles.Commands.UnlinkOauthIdentity do
  @moduledoc """
  Owns unlinking an OAuth identity by public reference and returning the view.

      UnlinkOauthIdentity -> transaction -> Query projection
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Profiles.{Effects, Oauth, Query}

  @pipeline operation: :accounts_profile_unlink_oauth_identity,
            access: :open,
            target: :login,
            params: [:public_ref]

  direct_pipeline execute_pipeline(login, public_ref) do
    change(fn _login, _operation_ref ->
      Oauth.unlink_identity_in_transaction(login, public_ref)
    end)

    present(fn user ->
      _ = Effects.revalidate_user(user)
      Query.linked_oauth_accounts(login)
    end)
  end

  @doc """
  Unlinks one owned OAuth binding by its public reference.

  ## Examples

      Accounts.Profiles.Commands.UnlinkOauthIdentity.run("alice", public_ref)
  """
  @spec run(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def run(login, public_ref) do
    execute_pipeline(login, public_ref)
  end
end
