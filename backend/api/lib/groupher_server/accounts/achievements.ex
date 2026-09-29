defmodule GroupherServer.Accounts.Achievements do
  @moduledoc """
  Public account boundary for reputation and moderation eligibility.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Achievements
        -> Repo
  """

  alias __MODULE__.{Moderatorable, Reputation}
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc "Runs `achieve` through the public `Achievements` boundary."
  @spec achieve(User.t(), atom(), atom()) :: T.done()
  def achieve(%User{} = user, operation, key), do: Reputation.achieve(user, operation, key)

  @doc "Runs `downgrade_achievement` through the public `Achievements` boundary."
  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  def downgrade_achievement(%User{} = user, action, count) do
    Reputation.downgrade_achievement(user, action, count)
  end

  @doc "Returns paged moderatorable communities from the `Achievements` read boundary."
  @spec paged_moderatorable_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_moderatorable_communities(%User{} = user, filter) do
    Moderatorable.paged_moderatorable_communities(user, filter)
  end
end
