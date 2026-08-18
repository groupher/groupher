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

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{Moderatorable, Reputation}

  @spec achieve(User.t(), atom(), atom()) :: T.done()
  @doc "Runs `achieve` through the public `Achievements` boundary."
  def achieve(%User{} = user, operation, key), do: Reputation.achieve(user, operation, key)

  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  @doc "Runs `downgrade_achievement` through the public `Achievements` boundary."
  def downgrade_achievement(%User{} = user, action, count) do
    Reputation.downgrade_achievement(user, action, count)
  end

  @spec paged_moderatorable_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged moderatorable communities from the `Achievements` read boundary."
  def paged_moderatorable_communities(%User{} = user, filter) do
    Moderatorable.paged_moderatorable_communities(user, filter)
  end
end
