defmodule GroupherServer.Accounts.Profiles.Commands.UpdateSubscribeState do
  @moduledoc """
  Owns rebuilding denormalized subscription fields on a user profile.

      subscription rows -> command transaction -> profile projection -> Effects
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Model.User
  alias Accounts.Profiles.Persist

  @pipeline operation: :accounts_profile_update_subscribe_state, access: :open, target: :user

  direct_pipeline execute_pipeline(user) do
    change(fn _user, _operation_ref -> Persist.rebuild_subscribe_state(user) end)
  end

  @doc """
  Rebuilds one user's subscribed-community count and ID projection.

  ## Examples

      Accounts.Profiles.Commands.UpdateSubscribeState.run(user)
  """
  @spec run(User.t()) :: {:ok, User.t()} | {:error, term()}
  def run(%User{} = user) do
    execute_pipeline(user)
  end
end
