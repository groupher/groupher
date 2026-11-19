defmodule GroupherServer.Accounts.Achievements.Commands.Ensure do
  @moduledoc """
  Owns achievement projection initialization for one account.

      Accounts registration -> Achievements facade -> Ensure -> Persist
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Achievements.Persist
  alias Accounts.Model.Achievement

  @pipeline operation: :accounts_achievements_ensure, access: :open, target: :user_id

  direct_pipeline execute_pipeline(user_id) do
    change(fn _user_id, _operation_ref -> Persist.ensure(user_id) end)
  end

  @doc """
  Ensures one user's achievement projection exists.

  ## Examples

      Accounts.Achievements.Commands.Ensure.run(user_id)
  """
  @spec run(integer()) :: {:ok, Achievement.t()} | {:error, term()}
  def run(user_id) when is_integer(user_id), do: execute_pipeline(user_id)
end
