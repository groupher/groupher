defmodule GroupherServer.Accounts.Achievements do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Achievements
  alias GroupherServer.Accounts.Model.User

  @spec achieve(User.t(), atom(), atom()) :: T.domain_res(User.t())
  def achieve(user, operation, key), do: Achievements.achieve(user, operation, key)

  @spec paged_moderatorable_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_moderatorable_communities(user, filter),
    do: Achievements.paged_moderatorable_communities(user, filter)

  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  def downgrade_achievement(user, action, count),
    do: Achievements.downgrade_achievement(user, action, count)
end
