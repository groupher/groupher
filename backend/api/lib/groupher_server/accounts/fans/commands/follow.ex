defmodule GroupherServer.Accounts.Fans.Commands.Follow do
  @moduledoc """
  Owns the atomic follow relationship mutation.

      Facade -> Follow command -> Persist + Effects -> commit -> delivery
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.Fans.{Effects, ErrorCat, Persist}
  alias Accounts.Model.User

  @pipeline operation: :accounts_fans_follow, access: :open, target: :user

  direct_pipeline execute_pipeline(user, follower) do
    prepare(fn -> Persist.prepare_pair(user, follower) end)

    change(fn %{user: user, target_user: target_user}, _operation_ref ->
      with {:ok, _relationships} <- Persist.insert_relationships(target_user, user),
           {:ok, target_user} <- Persist.update_follow_info(target_user, user, :add),
           {:ok, _achievement} <- record_achievement(target_user, :inc),
           {:ok, _event} <- Effects.enqueue_event(:follow, user, target_user) do
        {:ok, %{user: user, target_user: target_user}}
      else
        {:error, {:insert_follower_failed, _reason}} ->
          {:error, ErrorCat.already_did("already followed")}

        {:error, {:insert_following_failed, _reason}} ->
          {:error, ErrorCat.react_fails("follow fails")}

        {:error, _reason} = error ->
          error
      end
    end)

    present(fn %{user: user, target_user: target_user} = result ->
      _ = Effects.revalidate_users([user, target_user])
      {:ok, result.target_user}
    end)
  end

  @doc """
  Creates the follower relationship and its account effects.

  ## Examples

      Accounts.Fans.Commands.Follow.run(follower, target_user)
  """
  @spec run(User.t(), User.t()) :: {:ok, User.t()} | {:error, term()}
  def run(%User{} = user, %User{} = follower), do: execute_pipeline(user, follower)

  defp record_achievement(target_user, operation) do
    case Effects.record_achievement(target_user, operation) do
      {:ok, value} -> {:ok, value}
      {:error, _reason} -> {:error, ErrorCat.react_fails("follow achieve fails")}
    end
  end
end
