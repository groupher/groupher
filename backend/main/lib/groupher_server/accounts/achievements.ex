defmodule GroupherServer.Accounts.Achievements do
  @moduledoc """
  Accounts achievements facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.Types, as: T

  alias __MODULE__.{Membership, Moderatorable, Reputation}

  @spec achieve(User.t(), atom(), atom()) :: T.done()
  def achieve(%User{} = user, operation, key), do: Reputation.achieve(user, operation, key)

  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  def downgrade_achievement(%User{} = user, action, count) do
    Reputation.downgrade_achievement(user, action, count)
  end

  @spec set_member(User.t(), atom()) :: T.domain_res(User.t())
  def set_member(%User{} = user, plan), do: Membership.set_member(user, plan)

  @spec paged_moderatorable_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_moderatorable_communities(%User{} = user, filter) do
    Moderatorable.paged_moderatorable_communities(user, filter)
  end
end
