defmodule GroupherServer.Accounts.Profiles.Commands.UpdateProfile do
  @moduledoc """
  Owns the atomic user-profile mutation.

      UpdateProfile -> Persist -> commit -> Effects
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Model.User
  alias Accounts.Profiles.{Effects, Persist}

  @pipeline operation: :accounts_profile_update, access: :open, target: :user, params: [:attrs]

  direct_pipeline execute_pipeline(user, attrs) do
    change(fn _user, _operation_ref -> Persist.update_profile(user, attrs) end)

    present(fn user ->
      _ = Effects.revalidate_user(user)
      Effects.maybe_preload_social({:ok, user}, attrs)
    end)
  end

  @doc """
  Updates editable profile and optional social fields.

  ## Examples

      Accounts.Profiles.Commands.UpdateProfile.run(user, %{nickname: "Alice"})
  """
  @spec run(User.t(), map()) :: {:ok, User.t()} | {:error, term()}
  def run(%User{} = user, attrs) do
    execute_pipeline(user, attrs)
  end
end
