defmodule GroupherServer.Accounts.Profiles.Commands.LinkOauth do
  @moduledoc """
  Owns linking one verified OAuth identity to an existing account.

      LinkOauth command -> direct_pipeline runner -> Oauth row primitives -> Effects
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Model.User
  alias Accounts.Profiles.{Effects, Oauth}

  @pipeline operation: :accounts_profile_link_oauth,
            access: :open,
            target: :login,
            params: [:provider]

  direct_pipeline execute_pipeline(login, provider) do
    change(fn _login, _operation_ref -> Oauth.link_in_transaction(login, provider) end)

    present(fn user ->
      _ = Effects.revalidate_user(user)
      {:ok, user}
    end)
  end

  @doc """
  Links an OAuth provider and revalidates the changed account.

  ## Examples

      Accounts.Profiles.Commands.LinkOauth.run("alice", provider_payload)
  """
  @spec run(String.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def run(login, provider) do
    execute_pipeline(login, provider)
  end
end
