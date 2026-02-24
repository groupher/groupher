defmodule GroupherServer.Accounts.Customizations do
  @moduledoc false

  alias Helper.Types, as: T

  alias GroupherServer.Accounts.Delegate.Customization
  alias GroupherServer.Accounts.Model.{Customization, User}

  @type customization_value ::
          String.t()
          | number()
          | boolean()
          | nil
          | [String.t()]
          | map()

  @spec get_customization(User.t()) :: T.domain_res(Customization.t())
  def get_customization(user), do: Customization.get_customization(user)

  @spec set_customization(User.t(), atom(), customization_value()) ::
          T.domain_res(Customization.t())
  def set_customization(user, key, value), do: Customization.set_customization(user, key, value)

  @spec set_customization(User.t(), map()) :: T.domain_res(Customization.t())
  def set_customization(user, options), do: Customization.set_customization(user, options)

  @spec upgrade_by_plan(User.t(), atom()) :: T.domain_res(User.t())
  def upgrade_by_plan(user, plan), do: Customization.upgrade_by_plan(user, plan)
end
