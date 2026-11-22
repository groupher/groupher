defmodule GroupherServer.Accounts.Achievements do
  @moduledoc """
  Public account boundary for reputation and administered Community projections.

  Business position:

      Client / Auth -> Accounts facade -> Commands / AdministeredCommunities
                                      -> Persist / database projection
  """

  alias __MODULE__.{AdministeredCommunities, Commands}
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc """
  Records one achievement operation for a user.

  ## Examples

      Accounts.Achievements.achieve(user, :inc, :follow)
  """
  @spec achieve(User.t(), atom(), atom()) :: T.done()
  def achieve(%User{} = user, operation, key), do: Commands.Achieve.run(user, operation, key)

  @doc """
  Ensures the achievement projection exists during account registration.

  ## Examples

      Accounts.Achievements.ensure(user.id)
  """
  @spec ensure(integer()) :: {:ok, struct()} | {:error, term()}
  def ensure(user_id) when is_integer(user_id), do: Commands.Ensure.run(user_id)

  @doc """
  Removes a counted achievement from a user.

  ## Examples

      Accounts.Achievements.downgrade_achievement(user, :collect, 1)
  """
  @spec downgrade_achievement(User.t(), atom(), integer()) :: T.domain_res(User.t())
  def downgrade_achievement(%User{} = user, action, count) do
    Commands.Achieve.downgrade(user, action, count)
  end

  @doc """
  Returns paged Communities where the user is an Admin.

  ## Examples

      Accounts.Achievements.paged_administered_communities(user, %{page: 1, size: 20})
  """
  @spec paged_administered_communities(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_administered_communities(%User{} = user, filter) do
    AdministeredCommunities.paged_administered_communities(user, filter)
  end
end
